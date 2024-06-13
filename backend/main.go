package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"golang.org/x/crypto/bcrypt"
	"music.micr0.dev/backend/handlers"
	"music.micr0.dev/backend/middlewares"
	"music.micr0.dev/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"

	_ "net/http/pprof"
)

func main() {
	jwtSecret, exists := os.LookupEnv("JWT_SECRET")
	if !exists {
		log.Fatal("JWT_SECRET environment variable not set")
	}
	fmt.Println("JWT Secret Key Loaded:", jwtSecret)

	db, err := sqlx.Connect("sqlite3", "./music.db")
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v", err)
	}
	defer db.Close()

	// Get admin username and password from the command line arguments if they are provided
	if len(os.Args) == 3 {
		username := os.Args[1]
		password := os.Args[2]

		err = createUser(db, username, password)
		if err != nil {
			log.Fatalf("Failed to create user: %v", err)
		}

		fmt.Println("User created successfully")
		return
	}

	lastFmAPIKey := os.Getenv("LASTFM_API_KEY")
	if lastFmAPIKey == "" {
		log.Fatalf("Last.fm API key is not set in the environment variables")
	}

	gin.SetMode(gin.ReleaseMode)

	middlewares.Init([]byte(jwtSecret))

	models.InitializeDatabase(db)

	router := gin.Default()

	musicHandler := handlers.NewMusicHandler(db, lastFmAPIKey)

	// Public routes
	router.POST("/login", musicHandler.Login)
	router.GET("/thumbnail/:id", musicHandler.GetThumbnail)
	router.GET("/stream", musicHandler.StreamMusic)

	// Protected routes with authentication middleware
	authorized := router.Group("/")
	authorized.Use(middlewares.AuthMiddleware())
	{
		authorized.GET("/music", musicHandler.GetMusic)
		authorized.GET("/music/:id", musicHandler.GetMusicByID)
		authorized.POST("/music", musicHandler.UploadMusic)
		authorized.PUT("/music/:id", musicHandler.UpdateMusic)
		authorized.GET("/streamtoken/:id", musicHandler.GetStreamToken)

		// Playlist routes
		authorized.POST("/playlists", musicHandler.CreatePlaylist)
		authorized.GET("/playlists", musicHandler.GetPlaylists)
		authorized.GET("/playlists/:id", musicHandler.GetPlaylistByID)
		authorized.PUT("/playlists/:id", musicHandler.UpdatePlaylist)
		authorized.DELETE("/playlists/:id", musicHandler.DeletePlaylist)

		// Album routes
		authorized.GET("/albums", musicHandler.GetAlbums)
		authorized.GET("/albums/:id", musicHandler.GetAlbumByID)

		// Search route
		authorized.GET("/search", musicHandler.Search)

		// User routes
		authorized.GET("/whoami", musicHandler.WhoAmI)

	}

	fmt.Println("Go server listening on port 8084")
	log.Fatal(http.ListenAndServe(":8084", router))
}

func createUser(db *sqlx.DB, username, password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = db.Exec("INSERT INTO users (username, password) VALUES (?, ?)", username, hashedPassword)
	if err != nil {
		return err
	}

	return nil
}
