package models

import (
	"github.com/jmoiron/sqlx"
)

type Music struct {
	ID        string `db:"id" json:"id"`
	Title     string `db:"title" json:"title"`
	Artist    string `db:"artist" json:"artist"`
	Filename  string `db:"filename" json:"filename"`
	Duration  int    `db:"duration" json:"duration"`
	Thumbnail string `db:"thumbnail" json:"thumbnail"`
}

func InitializeDatabase(db *sqlx.DB) {
	_, err := db.Exec(`
        CREATE TABLE IF NOT EXISTS music (
            id TEXT PRIMARY KEY,
            title TEXT,
            artist TEXT,
            filename TEXT,
            duration INTEGER,
            thumbnail TEXT
        )
    `)
	if err != nil {
		panic(err)
	}
}
