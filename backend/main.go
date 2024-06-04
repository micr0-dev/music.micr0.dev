package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"music.micr0.dev/backend/handlers"
	"music.micr0.dev/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"

	_ "net/http/pprof"
)

func main() {
	db, err := sqlx.Connect("sqlite3", "./music.db")
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v", err)
	}
	defer db.Close()

	lastFmAPIKey := os.Getenv("LASTFM_API_KEY")
	if lastFmAPIKey == "" {
		log.Fatalf("Last.fm API key is not set in the environment variables")
	}

	gin.SetMode(gin.ReleaseMode)

	models.InitializeDatabase(db)

	router := gin.Default()

	musicHandler := handlers.NewMusicHandler(db, lastFmAPIKey)
	router.GET("/music", musicHandler.GetMusic)
	router.GET("/music/:id", musicHandler.GetMusicByID)
	router.POST("/music", musicHandler.UploadMusic)
	router.GET("/stream/:id", musicHandler.StreamMusic)
	router.GET("/thumbnail/:id", musicHandler.GetThumbnail)

	router.GET("/albums", musicHandler.GetAlbums)
	router.POST("/albums", musicHandler.CreateAlbum)
	router.GET("/albums/:album_id/music", musicHandler.GetMusicByAlbum)

	router.GET("/playlists", musicHandler.GetPlaylists)
	router.POST("/playlists", musicHandler.CreatePlaylist)
	router.GET("/playlists/:id", musicHandler.GetPlaylistByID)
	router.PUT("/playlists/:id", musicHandler.UpdatePlaylist)
	router.DELETE("/playlists/:id", musicHandler.DeletePlaylist)

	router.POST("/playlists/:playlist_id/music/:music_id", musicHandler.AddMusicToPlaylist)
	router.DELETE("/playlists/:playlist_id/music/:music_id", musicHandler.RemoveMusicFromPlaylist)
	router.GET("/playlists/:playlist_id/music", musicHandler.GetMusicByPlaylist)

	fmt.Println("Go server listening on port 8084")
	log.Fatal(http.ListenAndServe(":8084", router))
}
