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

	db, err := sqlx.Connect("sqlite3", "./music.db")
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v", err)
	}
	defer db.Close()

	// Get admin username and password from the command line arguments if they are provided
	if len(os.Args) == 4 && os.Args[1] == "add" {
		username := os.Args[2]
		password := os.Args[3]

		err = createUser(db, username, password)
		if err != nil {
			log.Fatalf("Failed to create user: %v", err)
		}

		fmt.Println("User created successfully")
		return
	} else if len(os.Args) == 3 && os.Args[1] == "remove" {
		username := os.Args[2]

		err = removeUser(db, username)
		if err != nil {
			log.Fatalf("Failed to remove user: %v", err)
		}

		fmt.Println("User removed successfully")
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
	router.GET("/share/validate", musicHandler.ValidateShare)

	// Public route for uptime monitoring
	router.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	// Protected routes with authentication middleware
	authorized := router.Group("/")
	authorized.Use(middlewares.AuthMiddleware())
	{
		authorized.GET("/music", musicHandler.GetMusic)
		authorized.GET("/music/:id", musicHandler.GetMusicByID)
		authorized.POST("/music", musicHandler.UploadMusic)
		authorized.PUT("/music/:id", musicHandler.UpdateMusic)
		authorized.GET("/streamtoken/:id", musicHandler.GetStreamToken)
		authorized.GET("/share/:id", musicHandler.ShareMusic)

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

		// User specific routes
		authorized.GET("/whoami", musicHandler.WhoAmI)
		authorized.GET("/user/uploaded", musicHandler.GetUserMusic)
		authorized.GET("/user/playlists", musicHandler.GetUserCreatedPlaylists)
		authorized.GET("/user/library", musicHandler.GetUserPlaylists)
		authorized.POST("/user/library/:id", musicHandler.AddToUserPlaylists)

	}

	fmt.Println("Go server listening on port 8084")
	log.Fatal(http.ListenAndServe(":8084", router))
}

func createUser(db *sqlx.DB, username, password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user := models.User{
		Username:    username,
		Password:    string(hashedPassword),
		PlaylistIDs: models.JSONStringArray{},
		UploadedIDs: models.JSONStringArray{},
		LibraryIDs:  models.JSONStringArray{},
	}

	_, err = db.NamedExec(`INSERT INTO users (username, password, playlist_ids, uploaded_ids, library_ids) VALUES (:username, :password, :playlist_ids, :uploaded_ids, :library_ids)`, user)
	return err
}

func removeUser(db *sqlx.DB, username string) error {
	_, err := db.Exec(`DELETE FROM users WHERE username = ?`, username)
	return err
}

// TODO: Add a sharing feature for songs and playlists that works without authentication for 24 hours
// TODO: Make actually good search and stuff
// TODO: Add a feature to edit the metadata of the songs
// TODO: Add a feature to delete songs
// TODO: Add a feature to delete playlists
// TODO: Make it so that better quality music overwrites the lower quality music
// TODO: Add a lyrics viewer for songs

// MIGHTDO: Music recommendations algorithm
