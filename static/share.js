document.addEventListener("DOMContentLoaded", async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        alert('Invalid or missing token for shared content.');
        return;
    }

    try {
        const response = await fetch(`/api/share/validate?token=${token}`);
        if (!response.ok) {
            throw new Error('Failed to validate share token');
        }

        const song = await response.json();
        displaySharedSong(song);
    } catch (error) {
        console.error('Error fetching shared song:', error);
        alert('Error fetching shared song');
    }
});

function displaySharedSong(song) {
    const musicList = document.getElementById('music-list');
    const songItem = `
        <div class="song-item" id="${song.id}">
            <img class="song-thumbnail" src="/api/thumbnail/${song.id}?size=100" alt="${song.title} cover" />
            <div class="song-info">
                <h3>${song.title}</h3>
                <p>${song.artist}</p>
            </div>
            <button onclick="playTrack(${song.id})">Play</button>
        </div>
    `;

    musicList.innerHTML = songItem;

    document.getElementById('track-title').textContent = song.title;
    document.getElementById('track-artist').textContent = song.artist;
    document.getElementById('mini-cover-art').src = `/api/thumbnail/${song.id}?size=100`;
}

function playTrack(songId) {
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.src = `/api/stream?token=${songId}`; // assuming token is needed for stream
    audioPlayer.play();
}
