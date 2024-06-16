package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/dhowden/tag"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/nfnt/resize"
	"golang.org/x/crypto/bcrypt"
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
		fmt.Println("Error opening image file:", err)
		return ""
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		fmt.Println("Error decoding image:", err)
		return ""
	}

	resizedImg := resize.Resize(100, 0, img, resize.Lanczos3)

	averageColor := calculateAverageColor(resizedImg)

	hexColor := fmt.Sprintf("#%02x%02x%02x", averageColor.R, averageColor.G, averageColor.B)

	return hexColor
}

func calculateAverageColor(img image.Image) color.RGBA {
	var r, g, b, a uint32
	pixelCount := 0

	for y := 0; y < img.Bounds().Dy(); y++ {
		for x := 0; x < img.Bounds().Dx(); x++ {
			pixelColor := img.At(x, y)
			red, green, blue, alpha := pixelColor.RGBA()

			r += red
			g += green
			b += blue
			a += alpha

			pixelCount++
		}
	}

	r /= uint32(pixelCount)
	g /= uint32(pixelCount)
	b /= uint32(pixelCount)
	a /= uint32(pixelCount)

	return color.RGBA{
		R: uint8(r >> 8),
		G: uint8(g >> 8),
		B: uint8(b >> 8),
		A: uint8(a >> 8),
	}
}

// Fetch lyrics from an external API
func fetchLyrics(title, artist string) (string, error) {
	url := fmt.Sprintf("https://api.lyrics.ovh/v1/%s/%s", artist, title)
	url = strings.ReplaceAll(url, " ", "+")

	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	lyrics, ok := result["lyrics"].(string)
	if !ok {
		return "No Lyrics", fmt.Errorf("lyrics not found")
	}

	return lyrics, nil
}

type metadata struct {
	Album string `json:"album"`
	Year  string `json:"year"`
	Genre string `json:"genre"`
}

func (h *MusicHandler) fetchMetadata(title, artist string) (metadata, error) {
	url := fmt.Sprintf("http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=" + h.LastFmAPIKey + "&artist=" + artist + "&track=" + title + "&format=json&autocorrect=1")
	url = strings.ReplaceAll(url, " ", "+")

	resp, err := http.Get(url)
	if err != nil {
		return metadata{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Print(url)
		return metadata{}, fmt.Errorf("failed to get data from Last.fm")
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return metadata{}, err
	}

	track, ok := result["track"].(map[string]interface{})
	if !ok {
		return metadata{}, fmt.Errorf("no track data found")
	}

	album, ok := track["album"].(map[string]interface{})
	if !ok {
		return metadata{}, fmt.Errorf("no album data found")
	}

	if track["wiki"] == nil {
		return metadata{
			Album: album["title"].(string),
			Year:  "",
		}, fmt.Errorf("no wiki data found")
	}

	date, ok := track["wiki"].(map[string]interface{})["published"].(string)
	if !ok {
		return metadata{}, fmt.Errorf("no release year found")
	}

	year := strings.Split(date, ",")[0]
	year = year[len(year)-4:]

	genre, ok := track["toptags"].(map[string]interface{})["tag"].([]interface{})
	if !ok || len(genre) == 0 {
		return metadata{}, fmt.Errorf("no genre found")
	}

	tags := make([]string, 0)
	for _, tag := range genre {
		tags = append(tags, tag.(map[string]interface{})["name"].(string))
	}

	return metadata{
		Album: album["title"].(string),
		Year:  year,
		Genre: strings.Join(tags, ", "),
	}, nil

}

func (h *MusicHandler) fetchThumbnail(title, artist string) (string, error) {
	url := fmt.Sprintf("http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=%s&artist=%s&track=%s&format=json&autocorrect=1", h.LastFmAPIKey, artist, title)
	url = strings.ReplaceAll(url, " ", "+")

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
	file, err := c.FormFile("file")
	if err != nil {
		log.Printf("Error getting file: %v", err)
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
		return
	}

	music := models.Music{
		ID:          id,
		Title:       metadata.Title(),
		Artist:      metadata.Artist(),
		AlbumArtist: metadata.AlbumArtist(),
		Filename:    filename,
		Thumbnail:   sql.NullString{String: "", Valid: false},
		Color:       "#000000",
		Album:       metadata.Album(),
		Year:        metadata.Year(),
		Genre:       metadata.Genre(),
		Lyrics:      metadata.Lyrics(),
	}

	var count int
	err = h.DB.Get(&count, "SELECT COUNT(*) FROM music WHERE title = ? AND artist = ?", music.Title, music.Artist)
	if err != nil {
		log.Printf("Error querying music: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check for existing music"})
		return
	}

	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Song already exists, try updating it instead with a PUT request"})
		return
	}

	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get username, is user middleware missing?"})
		return
	}

	var user models.User
	err = h.DB.Get(&user, "SELECT * FROM users WHERE username = ?", username)
	if err != nil {
		log.Printf("Error querying user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	user.UploadedIDs = append(user.UploadedIDs, id)
	if _, err := h.DB.NamedExec(`UPDATE users SET uploaded_ids = :uploaded_ids WHERE id = :id`, user); err != nil {
		log.Printf("Error updating user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id, "filename": filename})

	go func() {
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

		if music.Color == "#000000" {
			if music.Thumbnail.Valid {
				thumbnailPath := "./static/" + music.Thumbnail.String
				music.Color = getPrimaryColor(thumbnailPath)
				if music.Color == "" {
					music.Color = "#000000"
				}
			}
		}

		if music.Album == "" || music.Year == 0 || music.Genre == "" {
			metadata, err := h.fetchMetadata(music.Title, music.Artist)
			if err != nil {
				log.Printf("Error fetching metadata: %v", err)
			} else {
				if music.Album == "" {
					music.Album = metadata.Album
				}
				if music.Year == 0 {
					music.Year, _ = strconv.Atoi(metadata.Year)
				}
				if music.Genre == "" {
					music.Genre = metadata.Genre
				}
			}
		}

		if music.Lyrics == "" {
			lyrics, err := fetchLyrics(music.Title, music.Artist)
			if err != nil {
				log.Printf("Error fetching lyrics: %v", err)
			} else {
				music.Lyrics = lyrics
			}
		}

		if _, err := h.DB.NamedExec(`INSERT INTO music (id, title, artist, album_artist, album, year, genre, lyrics, filename, thumbnail, color) VALUES (:id, :title, :artist, :album_artist, :album, :year, :genre, :lyrics, :filename, :thumbnail, :color)`, music); err != nil {
			log.Printf("Error inserting music: %v", err)
			return
		}

		if music.Album != "" {
			var album models.Album
			err := h.DB.Get(&album, "SELECT * FROM albums WHERE title = ? AND artist = ?", music.Album, music.Artist)
			if err != nil {
				album.ID = generateUniqueID()
				album.Title = music.Album
				album.Artist = music.Artist
				album.Year = music.Year
				album.Genre = music.Genre
				album.Songs = []string{music.ID}

				if _, err := h.DB.NamedExec(`INSERT INTO albums (id, title, artist, year, genre, songs) VALUES (:id, :title, :artist, :year, :genre, :songs)`, album); err != nil {
					log.Printf("Error inserting album: %v", err)
				}
			} else {
				album.Songs = append(album.Songs, music.ID)
				if _, err := h.DB.NamedExec(`UPDATE albums SET songs = :songs WHERE id = :id`, album); err != nil {
					log.Printf("Error updating album: %v", err)
				}
			}
		}

		if music.Thumbnail.Valid {
			thumbnailPath := "./static/" + music.Thumbnail.String
			resizedThumbnailPath := getResizedThumbnailPath(thumbnailPath, 600)
			if _, err := resizeAndSaveImage(thumbnailPath, resizedThumbnailPath, 600); err != nil {
				log.Printf("Error resizing image: %v", err)
			}
			resizedThumbnailPath = getResizedThumbnailPath(thumbnailPath, 160)
			if _, err := resizeAndSaveImage(thumbnailPath, resizedThumbnailPath, 160); err != nil {
				log.Printf("Error resizing image: %v", err)
			}
		}
	}()
}

func (h *MusicHandler) UpdateMusic(c *gin.Context) {
	id := c.Param("id")
	var music models.Music
	if err := c.ShouldBindJSON(&music); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if _, err := h.DB.NamedExec(`UPDATE music SET title = :title, artist = :artist, album_artist = :album_artist, album = :album, year = :year, genre = :genre, lyrics = :lyrics WHERE id = :id`, map[string]interface{}{
		"id":           id,
		"title":        music.Title,
		"artist":       music.Artist,
		"album_artist": music.AlbumArtist,
		"filename":     music.Filename,
		"thumbnail":    music.Thumbnail,
		"color":        music.Color,
		"album":        music.Album,
		"year":         music.Year,
		"genre":        music.Genre,
		"lyrics":       music.Lyrics,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update music"})
		return
	}

	var album models.Album
	err := h.DB.Get(&album, "SELECT * FROM albums WHERE title = ? AND artist = ?", music.Album, music.Artist)
	if err != nil {
		album.ID = generateUniqueID()
		album.Title = music.Album
		album.Artist = music.Artist
		album.Year = music.Year
		album.Genre = music.Genre
		album.Songs = []string{id}

		if _, err := h.DB.NamedExec(`INSERT INTO albums (id, title, artist, year, genre, songs) VALUES (:id, :title, :artist, :year, :genre, :songs)`, album); err != nil {
			log.Printf("Error inserting album: %v", err)
			return
		}
	} else {
		album.Songs = append(album.Songs, id)
		if _, err := h.DB.NamedExec(`UPDATE albums SET songs = :songs WHERE id = :id`, album); err != nil {
			log.Printf("Error updating album: %v", err)
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Music updated successfully"})
}

func (h *MusicHandler) GetMusic(c *gin.Context) {
	limiter := c.Query("limit")

	var musics []models.Music
	err := h.DB.Select(&musics, "SELECT * FROM music")
	if err != nil {
		log.Printf("Error querying music: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get music"})
		return
	}

	for i, j := 0, len(musics)-1; i < j; i, j = i+1, j-1 {
		musics[i], musics[j] = musics[j], musics[i]
	}

	if limiter != "" {
		limit, err := strconv.Atoi(limiter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit parameter"})
			return
		}
		if limit > len(musics) {
			limit = len(musics)
		}
		musics = musics[:limit]
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

func (h *MusicHandler) GetUserMusic(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get username, is user middleware missing?"})
		return
	}

	var user models.User
	err := h.DB.Get(&user, "SELECT * FROM users WHERE username = ?", username)
	if err != nil {
		log.Printf("Error querying user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	var musics []models.Music
	query, args, err := sqlx.In("SELECT * FROM music WHERE id IN (?)", user.UploadedIDs)
	if err != nil {
		log.Printf("Error preparing query: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user music"})
		return
	}

	err = h.DB.Select(&musics, query, args...)
	if err != nil {
		log.Printf("Error querying music: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user music"})
		return
	}

	c.JSON(http.StatusOK, musics)
}

func (h *MusicHandler) StreamMusic(c *gin.Context) {
	tokenStr := c.Query("token")

	jwtKey, exists := os.LookupEnv("JWT_SECRET")
	if !exists {
		log.Fatal("JWT_SECRET environment variable not set")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "JWT secret not set"})
		return
	}

	claims := &StreamClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(jwtKey), nil
	})

	if err != nil || !token.Valid {
		log.Printf("Error validating token: %v", err)
		log.Printf("Token: %v", token)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	id := claims.MusicID

	var music models.Music
	err = h.DB.Get(&music, "SELECT filename FROM music WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Music not found"})
		return
	}
	c.File("./static/" + music.Filename)
}

func (h *MusicHandler) GetThumbnail(c *gin.Context) {
	id := c.Param("id")
	sizeStr := c.DefaultQuery("size", "300")
	size, err := strconv.Atoi(sizeStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid size parameter"})
		return
	}

	if id == "0" {
		originalThumbnailPath := "./placeholder.png"
		resizedThumbnailPath := getResizedThumbnailPath(originalThumbnailPath, size)
		if _, err := os.Stat(resizedThumbnailPath); os.IsNotExist(err) {
			if _, err := resizeAndSaveImage(originalThumbnailPath, resizedThumbnailPath, size); err != nil {
				log.Printf("Error resizing image: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resize image"})
				return
			}
		}
		c.File(resizedThumbnailPath)
		return
	}

	var music models.Music
	err = h.DB.Get(&music, "SELECT thumbnail FROM music WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Music not found"})
		return
	}

	if music.Thumbnail.Valid {
		originalThumbnailPath := "./static/" + music.Thumbnail.String
		resizedThumbnailPath := getResizedThumbnailPath(originalThumbnailPath, size)

		if _, err := os.Stat(resizedThumbnailPath); os.IsNotExist(err) {
			if _, err := resizeAndSaveImage(originalThumbnailPath, resizedThumbnailPath, size); err != nil {
				log.Printf("Error resizing image: %v", err)
				originalThumbnailPath := "./placeholder.png"
				resizedThumbnailPath := getResizedThumbnailPath(originalThumbnailPath, size)
				if _, err := os.Stat(resizedThumbnailPath); os.IsNotExist(err) {
					if _, err := resizeAndSaveImage(originalThumbnailPath, resizedThumbnailPath, size); err != nil {
						log.Printf("Error resizing image: %v", err)
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resize image"})
						return
					}
				}
				c.File(resizedThumbnailPath)
			}
		}

		c.File(resizedThumbnailPath)
	} else {
		originalThumbnailPath := "./placeholder.png"
		resizedThumbnailPath := getResizedThumbnailPath(originalThumbnailPath, size)
		if _, err := os.Stat(resizedThumbnailPath); os.IsNotExist(err) {
			if _, err := resizeAndSaveImage(originalThumbnailPath, resizedThumbnailPath, size); err != nil {
				log.Printf("Error resizing image: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resize image"})
				return
			}
		}
		c.File(resizedThumbnailPath)
	}
}

func getResizedThumbnailPath(originalPath string, width int) string {
	ext := filepath.Ext(originalPath)
	name := originalPath[0 : len(originalPath)-len(ext)]
	return name + "_resized_" + strconv.Itoa(width) + ext
}

func resizeAndSaveImage(originalPath, resizedPath string, width int) (string, error) {
	file, err := os.Open(originalPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	img, format, err := image.Decode(file)
	if err != nil {
		return "", err
	}

	resizedImg := resize.Resize(uint(width), 0, img, resize.Lanczos3)

	out, err := os.Create(resizedPath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	switch format {
	case "jpeg":
		err = jpeg.Encode(out, resizedImg, nil)
	case "png":
		err = png.Encode(out, resizedImg)
	default:
		return "", formatErr(format)
	}

	return resizedPath, err
}

func formatErr(format string) error {
	return fmt.Errorf("unsupported format: %s", format)
}

func (h *MusicHandler) CreatePlaylist(c *gin.Context) {
	var playlist models.Playlist
	if err := c.ShouldBindJSON(&playlist); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	playlist.ID = generateUniqueID()
	playlist.Songs = []string{}

	if _, err := h.DB.NamedExec(`INSERT INTO playlists (id, name, songs) VALUES (:id, :name, :songs)`, playlist); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create playlist"})
		return
	}

	// Add playlist to user's playlist IDs
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get username, is user middleware missing?"})
		return
	}

	var user models.User
	err := h.DB.Get(&user, "SELECT * FROM users WHERE username = ?", username)
	if err != nil {
		log.Printf("Error querying user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	user.PlaylistIDs = append(user.PlaylistIDs, playlist.ID)
	if _, err := h.DB.NamedExec(`UPDATE users SET playlist_ids = :playlist_ids WHERE id = :id`, user); err != nil {
		log.Printf("Error updating user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusCreated, playlist)
}

func (h *MusicHandler) GetPlaylists(c *gin.Context) {
	limiter := c.Query("limit")

	var playlists []models.Playlist
	err := h.DB.Select(&playlists, "SELECT id, name, songs FROM playlists")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get playlists"})
		return
	}

	for i, j := 0, len(playlists)-1; i < j; i, j = i+1, j-1 {
		playlists[i], playlists[j] = playlists[j], playlists[i]
	}

	if limiter != "" {
		limit, err := strconv.Atoi(limiter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit parameter"})
			return
		}
		if limit > len(playlists) {
			limit = len(playlists)
		}
		playlists = playlists[:limit]
	}

	c.JSON(http.StatusOK, playlists)
}

// make returnPlaylist
type returnPlaylist struct {
	ID      string         `json:"id"`
	Name    string         `json:"name"`
	Songs   []models.Music `json:"songs"`
	SongIDs []string       `json:"song_ids"`
}

func (h *MusicHandler) GetPlaylistByID(c *gin.Context) {
	id := c.Param("id")
	limiter := c.Query("limit")
	offset := c.Query("offset")

	var playlist models.Playlist
	err := h.DB.Get(&playlist, "SELECT id, name, songs FROM playlists WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playlist not found"})
		return
	}

	for i, j := 0, len(playlist.Songs)-1; i < j; i, j = i+1, j-1 {
		playlist.Songs[i], playlist.Songs[j] = playlist.Songs[j], playlist.Songs[i]
	}

	if offset != "" {
		off, err := strconv.Atoi(offset)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset parameter"})
			return
		}
		if off > len(playlist.Songs) {
			off = len(playlist.Songs)
		}
		playlist.Songs = playlist.Songs[off:]
	}

	if limiter != "" {
		limit, err := strconv.Atoi(limiter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit parameter"})
			return
		}
		if limit > len(playlist.Songs) {
			limit = len(playlist.Songs)
		}
		playlist.Songs = playlist.Songs[:limit]
	}

	var songs []models.Music

	for _, songID := range playlist.Songs {
		var song models.Music
		err := h.DB.Get(&song, "SELECT id, title, artist, filename, thumbnail, color FROM music WHERE id = ?", songID)
		if err != nil {
			log.Printf("Error fetching song: %v", err)
			continue
		}
		songs = append(songs, song)
	}

	returnPlaylist := returnPlaylist{
		ID:      playlist.ID,
		Name:    playlist.Name,
		Songs:   songs,
		SongIDs: playlist.Songs,
	}

	c.JSON(http.StatusOK, returnPlaylist)
}

func (h *MusicHandler) UpdatePlaylist(c *gin.Context) {
	id := c.Param("id")
	var playlist models.Playlist
	if err := c.ShouldBindJSON(&playlist); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if _, err := h.DB.NamedExec(`UPDATE playlists SET name = :name, songs = :songs WHERE id = :id`, map[string]interface{}{
		"id":    id,
		"name":  playlist.Name,
		"songs": playlist.Songs,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update playlist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Playlist updated successfully"})
}

func (h *MusicHandler) DeletePlaylist(c *gin.Context) {
	id := c.Param("id")

	if _, err := h.DB.Exec("DELETE FROM playlists WHERE id = ?", id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete playlist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Playlist deleted successfully"})
}

func (h *MusicHandler) GetUserPlaylists(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get username, is user middleware missing?"})
		return
	}

	var user models.User
	err := h.DB.Get(&user, "SELECT * FROM users WHERE username = ?", username)
	if err != nil {
		log.Printf("Error querying user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	var playlistIDs []string
	for _, playlistID := range user.PlaylistIDs {
		playlistIDs = append(playlistIDs, playlistID)
	}

	var playlists []models.Playlist
	for _, playlistID := range playlistIDs {
		var playlist models.Playlist
		err := h.DB.Get(&playlist, "SELECT id, name, songs FROM playlists WHERE id = ?", playlistID)
		if err != nil {
			log.Printf("Error fetching playlist: %v", err)
			continue
		}
		playlists = append(playlists, playlist)
	}

	c.JSON(http.StatusOK, playlists)
}

func (h *MusicHandler) Search(c *gin.Context) {
	limiter := c.Query("limit")
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
		return
	}

	// Prepare the fuzzy search query
	likeQuery := "%" + strings.ToLower(query) + "%"

	// Search songs across all relevant fields
	var songs []models.Music
	songQuery := `
	SELECT * FROM music
	WHERE 
		LOWER(id) LIKE ? OR
		LOWER(title) LIKE ? OR
		LOWER(artist) LIKE ? OR
		LOWER(album_artist) LIKE ? OR
		LOWER(filename) LIKE ? OR
		LOWER(album) LIKE ? OR
		LOWER(genre) LIKE ? OR
		LOWER(lyrics) LIKE ?
	`
	err := h.DB.Select(&songs, songQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery)
	if err != nil {
		log.Printf("Error querying songs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search songs"})
		return
	}

	// Search playlists by name and songs
	var playlists []models.Playlist
	playlistQuery := `
	SELECT * FROM playlists
	WHERE
		LOWER(id) LIKE ? OR
		LOWER(name) LIKE ? OR
		LOWER(songs) LIKE ?
	`

	err = h.DB.Select(&playlists, playlistQuery, likeQuery, likeQuery, likeQuery)
	if err != nil {
		log.Printf("Error querying playlists: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search playlists"})
		return
	}

	// Search albums
	var albums []models.Album
	albumQuery := `
	SELECT * FROM albums
	WHERE
		LOWER(id) LIKE ? OR
		LOWER(title) LIKE ? OR
		LOWER(artist) LIKE ? OR
		LOWER(songs) LIKE ?
	`

	err = h.DB.Select(&albums, albumQuery, likeQuery, likeQuery, likeQuery, likeQuery)
	if err != nil {
		log.Printf("Error querying albums: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search albums"})
		return
	}

	// Combine results
	result := map[string]interface{}{
		"songs":     songs,
		"playlists": playlists,
		"albums":    albums,
	}

	if limiter != "" {
		limit, err := strconv.Atoi(limiter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit parameter"})
			return
		}

		if limit > len(songs) {
			limit = len(songs)
		}
		result["songs"] = songs[:limit]

		if limit > len(playlists) {
			limit = len(playlists)
		}
		result["playlists"] = playlists[:limit]

		if limit > len(albums) {
			limit = len(albums)
		}
		result["albums"] = albums[:limit]
	}

	c.JSON(http.StatusOK, result)
}

func (h *MusicHandler) GetAlbums(c *gin.Context) {
	var albums []models.Album
	err := h.DB.Select(&albums, "SELECT * FROM albums")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get albums"})
		return
	}

	c.JSON(http.StatusOK, albums)
}

func (h *MusicHandler) GetAlbumByID(c *gin.Context) {
	id := c.Param("id")
	var album models.Album
	err := h.DB.Get(&album, "SELECT * FROM albums WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Album not found"})
		return
	}
	c.JSON(http.StatusOK, album)
}

type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type Claims struct {
	Username string `json:"username"`
	jwt.StandardClaims
}

func (h *MusicHandler) Login(c *gin.Context) {
	jwtKey, exists := os.LookupEnv("JWT_SECRET")
	if !exists {
		log.Fatal("JWT_SECRET environment variable not set")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "JWT secret not set"})
		return
	}

	var creds Credentials
	if err := c.BindJSON(&creds); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var user models.User
	err := h.DB.Get(&user, "SELECT * FROM users WHERE username = ?", creds.Username)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(creds.Password)) != nil {
		log.Printf("Error querying user: %v", err)
		log.Printf("User: %v", user)
		log.Printf(" creds: %v", creds)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	expirationTime := time.Now().Add(24 * time.Hour * 7) // 1 week expiry
	claims := &Claims{
		Username: user.Username,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	tokenString, err := token.SignedString([]byte(jwtKey))
	if err != nil {
		log.Printf("Error signing token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Login successful", "token": tokenString})
}

type StreamClaims struct {
	MusicID string `json:"musicId"`
	jwt.StandardClaims
}

func GenerateStreamToken(musicID string, secret []byte, expireIn time.Duration) (string, error) {
	expirationTime := time.Now().Add(expireIn) // 15-minute expiry
	claims := &StreamClaims{
		MusicID: musicID,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

func (h *MusicHandler) GetStreamToken(c *gin.Context) {
	musicID := c.Param("id")

	jwtKey, exists := os.LookupEnv("JWT_SECRET")
	if !exists {
		log.Fatal("JWT_SECRET environment variable not set")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "JWT secret not set"})
		return
	}

	token, err := GenerateStreamToken(musicID, []byte(jwtKey), 15*time.Minute)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate stream token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token})
}

func (h *MusicHandler) WhoAmI(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get username"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"username": username})
}

func (h *MusicHandler) AddToUserPlaylists(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get username"})
		return
	}

	id := c.Param("id")

	var user models.User
	err := h.DB.Get(&user, "SELECT * FROM users WHERE username = ?", username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	for _, playlistID := range user.PlaylistIDs {
		if playlistID == id {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Playlist already exists in user's playlists"})
			return
		}
	}

	user.PlaylistIDs = append(user.PlaylistIDs, id)
	if _, err := h.DB.NamedExec(`UPDATE users SET playlist_ids = :playlist_ids WHERE id = :id`, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Playlist added to user's playlists"})
}

func (h *MusicHandler) ShareMusic(c *gin.Context) {
	musicID := c.Param("id")
	var music models.Music
	err := h.DB.Get(&music, "SELECT * FROM music WHERE id = ?", musicID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Music not found"})
		return
	}

	jwtKey, exists := os.LookupEnv("JWT_SECRET")
	if !exists {
		log.Fatal("JWT_SECRET environment variable not set")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "JWT secret not set"})
		return
	}

	token, err := GenerateStreamToken(musicID, []byte(jwtKey), 24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate stream token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token})
}
