package models

import (
	"database/sql"

	"github.com/jmoiron/sqlx"
)

type Music struct {
	ID        string         `db:"id" json:"id"`
	Title     string         `db:"title" json:"title"`
	Artist    string         `db:"artist" json:"artist"`
	Filename  string         `db:"filename" json:"filename"`
	Thumbnail sql.NullString `db:"thumbnail" json:"thumbnail,omitempty"`
	Color     string         `db:"color" json:"color"`
}

type Playlist struct {
	ID    string   `db:"id" json:"id"`
	Name  string   `db:"name" json:"name"`
	Songs []string `db:"songs" json:"songs"`
}

func InitializeDatabase(db *sqlx.DB) {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS music (
			id TEXT PRIMARY KEY,
			title TEXT,
			artist TEXT,
			filename TEXT,
			duration INTEGER,
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
}
