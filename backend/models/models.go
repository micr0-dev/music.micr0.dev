package models

import (
	"database/sql"

	"github.com/jmoiron/sqlx"
)

type Music struct {
	ID        string         `db:"id" json:"id"`
	Title     string         `db:"title" json:"title"`
	Artist    string         `db:"artist" json:"artist"`
	Album     string         `db:"album" json:"album,omitempty"`
	Filename  string         `db:"filename" json:"filename"`
	Thumbnail sql.NullString `db:"thumbnail" json:"thumbnail,omitempty"`
	Color     string         `json:"color,omitempty"`
}

type Playlist struct {
	ID   string `db:"id" json:"id"`
	Name string `db:"name" json:"name"`
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
        )
    `)
	if err != nil {
		panic(err)
	}

	_, err = db.Exec(`
CREATE TABLE IF NOT EXISTS playlists (
	id TEXT PRIMARY KEY,
	name TEXT
)
`)
	if err != nil {
		panic(err)
	}

	_, err = db.Exec(`
CREATE TABLE IF NOT EXISTS playlist_music (
	playlist_id TEXT,
	music_id TEXT,
	PRIMARY KEY (playlist_id, music_id),
	FOREIGN KEY (playlist_id) REFERENCES playlists(id),
	FOREIGN KEY (music_id) REFERENCES music(id)
)
`)
	if err != nil {
		panic(err)
	}
}
