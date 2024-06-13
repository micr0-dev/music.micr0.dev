package models

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"

	"github.com/jmoiron/sqlx"
)

type Music struct {
	ID          string         `db:"id" json:"id"`
	Title       string         `db:"title" json:"title"`
	Artist      string         `db:"artist" json:"artist"`
	AlbumArtist string         `db:"album_artist" json:"album_artist"`
	Filename    string         `db:"filename" json:"filename"`
	Thumbnail   sql.NullString `db:"thumbnail" json:"thumbnail"`
	Color       string         `db:"color" json:"color"`
	Album       string         `db:"album" json:"album"`
	Year        int            `db:"year" json:"year"`
	Genre       string         `db:"genre" json:"genre"`
	Lyrics      string         `db:"lyrics" json:"lyrics"`
}

type JSONStringArray []string

func (j *JSONStringArray) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("type assertion to []byte failed")
	}

	return json.Unmarshal(bytes, j)
}

func (j JSONStringArray) Value() (driver.Value, error) {
	return json.Marshal(j)
}

type Playlist struct {
	ID    string          `db:"id" json:"id"`
	Name  string          `db:"name" json:"name"`
	Songs JSONStringArray `db:"songs" json:"songs"`
}

type Album struct {
	ID     string          `db:"id" json:"id"`
	Title  string          `db:"title" json:"title"`
	Artist string          `db:"artist" json:"artist"`
	Year   int             `db:"year" json:"year"`
	Genre  string          `db:"genre" json:"genre"`
	Songs  JSONStringArray `db:"songs" json:"songs"`
}

type User struct {
	ID          int             `db:"id" json:"id"`
	Username    string          `db:"username" json:"username"`
	Password    string          `db:"password" json:"-"`
	PlaylistIDs JSONStringArray `db:"playlist_ids" json:"playlist_ids"`
	UploadedIDs JSONStringArray `db:"uploaded_ids" json:"uploaded_ids"`
}

func InitializeDatabase(db *sqlx.DB) {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS music (
			id TEXT PRIMARY KEY,
			title TEXT,
			artist TEXT,
			album_artist TEXT,
			album TEXT,
			year INTEGER,
			genre TEXT,
			lyrics TEXT,
			filename TEXT,
			thumbnail TEXT,
			color TEXT
		)
	`)
	if err != nil {
		panic(err)
	}

	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT,
            songs TEXT
        )
    `)
	if err != nil {
		panic(err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS albums (
			id TEXT PRIMARY KEY,
			title TEXT,
			artist TEXT,
			year INTEGER,
			genre TEXT,
			songs TEXT
		)
	`)
	if err != nil {
		panic(err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT,
			password TEXT,
			playlist_ids TEXT,
			uploaded_ids TEXT
		)
	`)
	if err != nil {
		panic(err)
	}
}
