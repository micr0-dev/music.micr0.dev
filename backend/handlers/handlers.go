package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"music.micr0.dev/backend/models"
)

type MusicHandler struct {
	DB *sqlx.DB
}

func NewMusicHandler(db *sqlx.DB) *MusicHandler {
	return &MusicHandler{DB: db}
}

func generateUniqueID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		print(err)
		return
	}

	music := models.Music{
		ID:       id,
		Title:    title,
		Artist:   artist,
		Filename: filename,
	}

	if _, err := h.DB.NamedExec(`INSERT INTO music (id, title, artist, filename) VALUES (:id, :title, :artist, :filename)`, &music); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert into database"})
		print(err)
		return
	}

	c.JSON(http.StatusCreated, music)
}

func (h *MusicHandler) GetMusic(c *gin.Context) {
	var musics []models.Music
	err := h.DB.Select(&musics, "SELECT * FROM music")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get music"})
		print(err)
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
