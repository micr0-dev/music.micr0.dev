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
	Color     string         `json:"color,omitempty"`
}
type Playlist struct {
	ID          string `db:"id" json:"id"`
	Name        string `db:"name" json:"name"`
	Description string `db:"description" json:"description"`
}

type Album struct {
	ID     string `db:"id" json:"id"`
	Name   string `db:"name" json:"name"`
	Artist string `db:"artist" json:"artist"`
}

type PlaylistSong struct {
	PlaylistID string `db:"playlist_id" json:"playlist_id"`
	SongID     string `db:"song_id" json:"song_id"`
}

func InitializeDatabase(db *sqlx.DB) {
	_, err := db.Exec(`
        CREATE TABLE IF NOT EXISTS music (
            id TEXT PRIMARY KEY,
            title TEXT,
            artist TEXT,
            album TEXT,
            filename TEXT,
            thumbnail TEXT,
            color TEXT
        );

        CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT
        );

		CREATE TABLE IF NOT EXISTS albums (
            id TEXT PRIMARY KEY,
            name TEXT,
			artist TEXT
        );

        CREATE TABLE IF NOT EXISTS playlist_songs (
            playlist_id TEXT,
            song_id TEXT,
            PRIMARY KEY (playlist_id, song_id)
        );
    `)
	if err != nil {
		panic(err)
	}
}
