package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"

	"github.com/dhowden/tag"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/nfnt/resize"
	"music.micr0.dev/backend/models"
)

type MusicHandler struct {
	DB           *sqlx.DB
	LastFmAPIKey string
}

func NewMusicHandler(db *sqlx.DB, lastFmAPIKey string) *MusicHandler {
	return &MusicHandler{DB: db, LastFmAPIKey: lastFmAPIKey}
}

func generateUniqueID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

func readMetadata(filepath string) (tag.Metadata, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	metadata, err := tag.ReadFrom(file)
	if err != nil {
		return nil, err
	}
	return metadata, nil
}

func getPrimaryColor(filepath string) string {
	file, err := os.Open(filepath)
	if err != nil {
		return ""
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return ""
	}

	// Resize to a smaller size for faster processing
	resizedImg := resize.Resize(100, 0, img, resize.Lanczos3)

	// Create a map to store color counts
	colorCounts := make(map[string]int)

	// Iterate over pixels and count color occurrences
	bounds := resizedImg.Bounds()
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, _ := resizedImg.At(x, y).RGBA()
			colorHex := rgbToHex(uint8(r>>8), uint8(g>>8), uint8(b>>8))
			colorCounts[colorHex]++
		}
	}

	// Sort colors by brightness and prominence
	type colorItem struct {
		Color      string
		Count      int
		Brightness float64
	}
	var colorItems []colorItem
	for colorHex, count := range colorCounts {
		r, g, b := hexToRGB(colorHex)
		brightness := getBrightness(r, g, b)
		colorItems = append(colorItems, colorItem{
			Color:      colorHex,
			Count:      count,
			Brightness: brightness,
		})
	}
	sort.Slice(colorItems, func(i, j int) bool {
		if colorItems[i].Brightness == colorItems[j].Brightness {
			return colorItems[i].Count > colorItems[j].Count
		}
		return colorItems[i].Brightness > colorItems[j].Brightness
	})

	// Return the most prominent bright color
	if len(colorItems) > 0 {
		return colorItems[0].Color
	}

	return "" // Default to no color if the image has no pixels
}

func getBrightness(r, g, b uint8) float64 {
	return 0.299*float64(r) + 0.587*float64(g) + 0.114*float64(b)
}

func hexToRGB(hex string) (uint8, uint8, uint8) {
	var r, g, b uint8
	fmt.Sscanf(hex, "#%02x%02x%02x", &r, &g, &b)
	return r, g, b
}

func rgbToHex(r, g, b uint8) string {
	return fmt.Sprintf("#%02x%02x%02x", r, g, b)
}

func (h *MusicHandler) fetchThumbnail(title, artist string) (string, error) {
	url := fmt.Sprintf("http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=%s&artist=%s&track=%s&format=json", h.LastFmAPIKey, artist, title)
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to get data from Last.fm")
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	track, ok := result["track"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("no track data found")
	}

	album, ok := track["album"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("no album data found")
	}

	images, ok := album["image"].([]interface{})
	if !ok || len(images) == 0 {
		return "", fmt.Errorf("no images found")
	}

	// Assume the last image in the list is the largest one.
	largestImage := images[len(images)-1].(map[string]interface{})
	imageURL, ok := largestImage["#text"].(string)
	if !ok || imageURL == "" {
		return "", fmt.Errorf("no image URL found")
	}

	return imageURL, nil
}

func downloadImage(url, filepath string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	out, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

func (h *MusicHandler) UploadMusic(c *gin.Context) {
	title := c.PostForm("title")
	artist := c.PostForm("artist")

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file"})
		return
	}

	id := generateUniqueID()
	filename := id + filepath.Ext(file.Filename)
	filepath := "./static/" + filename

	if err := c.SaveUploadedFile(file, filepath); err != nil {
		log.Printf("Error saving file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	metadata, err := readMetadata(filepath)
	if err != nil {
		log.Printf("Error reading metadata: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read metadata"})
		return
	}

	music := models.Music{
		ID:        id,
		Title:     title,
		Artist:    artist,
		Filename:  filename,
		Thumbnail: sql.NullString{String: "", Valid: false},
		Color:     "",
	}

	if music.Title == "" {
		music.Title = metadata.Title()
	}

	if music.Artist == "" {
		music.Artist = metadata.Artist()
	}

	if music.Thumbnail == (sql.NullString{}) {
		if metadata.Picture() != nil {
			music.Thumbnail = sql.NullString{String: id + ".jpg", Valid: true}
			thumbnailPath := "./static/" + music.Thumbnail.String
			thumbnailFile, err := os.Create(thumbnailPath)
			if err != nil {
				log.Printf("Error creating thumbnail: %v", err)
			} else {
				_, err = thumbnailFile.Write(metadata.Picture().Data)
				if err != nil {
					log.Printf("Error writing thumbnail: %v", err)
				}
			}
		} else {
			thumbnailURL, err := h.fetchThumbnail(music.Title, music.Artist)
			if err != nil {
				log.Printf("Error fetching thumbnail: %v", err)
			} else {
				music.Thumbnail = sql.NullString{String: id + ".jpg", Valid: true}
				thumbnailPath := "./static/" + music.Thumbnail.String
				if err := downloadImage(thumbnailURL, thumbnailPath); err != nil {
					log.Printf("Error downloading thumbnail: %v", err)
				}
			}
		}
	}

	if music.Color == "" {
		if music.Thumbnail.Valid {
			thumbnailPath := "./static/" + music.Thumbnail.String
			music.Color = getPrimaryColor(thumbnailPath)
		} else {
			music.Color = "#000000"
		}
	}

	if _, err := h.DB.NamedExec(`INSERT INTO music (id, title, artist, filename, thumbnail) VALUES (:id, :title, :artist, :filename, :thumbnail)`, &music); err != nil {
		log.Printf("Error inserting music: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert into database"})
		return
	}

	c.JSON(http.StatusCreated, music)
}

func (h *MusicHandler) GetMusic(c *gin.Context) {
	var musics []models.Music
	err := h.DB.Select(&musics, "SELECT * FROM music")
	if err != nil {
		log.Printf("Error querying music: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get music"})
		return
	}
	c.JSON(http.StatusOK, musics)
}

func (h *MusicHandler) GetMusicByID(c *gin.Context) {
	id := c.Param("id")
	var music models.Music
	err := h.DB.Get(&music, "SELECT * FROM music WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Music not found"})
		return
	}
	c.JSON(http.StatusOK, music)
}

func (h *MusicHandler) StreamMusic(c *gin.Context) {
	id := c.Param("id")
	var music models.Music
	err := h.DB.Get(&music, "SELECT filename FROM music WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Music not found"})
		return
	}
	c.File("./static/" + music.Filename)
}

func (h *MusicHandler) GetThumbnail(c *gin.Context) {
	id := c.Param("id")
	sizeStr := c.DefaultQuery("size", "300") // Default size to 100 if not specified
	size, err := strconv.Atoi(sizeStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid size parameter"})
		return
	}

	var music models.Music
	err = h.DB.Get(&music, "SELECT thumbnail FROM music WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Music not found"})
		return
	}

	if music.Thumbnail.Valid {
		thumbnailPath := "./static/" + music.Thumbnail.String
		if resizedPath, err := resizeImage(thumbnailPath, size); err == nil {
			c.File(resizedPath)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resize image"})
		}
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "Thumbnail not found"})
	}
}

func resizeImage(filepath string, width int) (string, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	img, format, err := image.Decode(file)
	if err != nil {
		return "", err
	}

	m := resize.Resize(uint(width), 0, img, resize.Lanczos3)

	resizedFilePath := filepath + "_resized_" + strconv.Itoa(width) + ".jpg"
	out, err := os.Create(resizedFilePath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	switch format {
	case "jpeg":
		err = jpeg.Encode(out, m, nil)
	case "png":
		err = png.Encode(out, m)
	default:
		return "", fmt.Errorf("unsupported format: %s", format)
	}

	return resizedFilePath, err
}

func (h *MusicHandler) GetColor(c *gin.Context) {
	id := c.Param("id")
	var music models.Music
	err := h.DB.Get(&music, "SELECT color FROM music WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Music not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"color": music.Color})
}
