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

func InitializeDatabase(db *sqlx.DB) {
	_, err := db.Exec(`
        CREATE TABLE IF NOT EXISTS music (
            id TEXT PRIMARY KEY,
            title TEXT,
            artist TEXT,
            filename TEXT,
            thumbnail TEXT,
			color TEXT
        )
    `)
	if err != nil {
		panic(err)
	}
}
