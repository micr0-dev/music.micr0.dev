package main

import (
	"fmt"
	"log"
	"net/http"

	"music.micr0.dev/backend/handlers"
	"music.micr0.dev/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	db, err := sqlx.Connect("sqlite3", "./music.db")
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v", err)
	}
	defer db.Close()

	gin.SetMode(gin.ReleaseMode)

	models.InitializeDatabase(db)

	router := gin.Default()

	musicHandler := handlers.NewMusicHandler(db)
	router.GET("/music", musicHandler.GetMusic)
	router.GET("/music/:id", musicHandler.GetMusicByID)
	router.POST("/music", musicHandler.UploadMusic)
	router.GET("/stream/:id", musicHandler.StreamMusic)
	router.Static("/static", "./static")

	fmt.Println("Go server listening on port 8084")
	log.Fatal(http.ListenAndServe(":8084", router))
}
