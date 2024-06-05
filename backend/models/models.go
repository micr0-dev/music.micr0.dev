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
	Color     string         `db:"color,omitempty"`
}

type Playlist struct {
	ID          string `db:"id" json:"id"`
	Name        string `db:"name" json:"name"`
	Description string `db:"description" json:"description"`
}

type PlaylistItem struct {
	ID         string `db:"id" json:"id"`
	PlaylistID string `db:"playlist_id" json:"playlist_id"`
	MusicID    string `db:"music_id" json:"music_id"`
}

func InitializeDatabase(db *sqlx.DB) {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS music (
			id TEXT PRIMARY KEY,
			title TEXT,
			artist TEXT,
			filename TEXT,
			thumbnail TEXT,
			color TEXT
		);

		CREATE TABLE IF NOT EXISTS playlists (
			id TEXT PRIMARY KEY,
			name TEXT,
			description TEXT
		);

		CREATE TABLE IF NOT EXISTS playlist_items (
			id TEXT PRIMARY KEY,
			playlist_id TEXT,
			music_id TEXT,
			FOREIGN KEY (playlist_id) REFERENCES playlists(id),
			FOREIGN KEY (music_id) REFERENCES music(id)
		);
	`)
	if err != nil {
		panic(err)
	}
}
