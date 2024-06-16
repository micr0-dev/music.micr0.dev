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
        displaySharedSong(song, token);
    } catch (error) {
        console.error('Error fetching shared song:', error);
        alert('Error fetching shared song');
    }
});

function displaySharedSong(song, token) {
    const musicListTitle = document.getElementById('music-list-title');
    musicListTitle.textContent = 'Shared Song';
    const musicList = document.getElementById('music-list');
    const songItem = `
        <div class="music-item" style="--art-color: "${song.color}";" id="${song.id}">
            <img src="/api/thumbnail/${song.id}?size=160" alt="cover art" class="cover-art" loading="lazy">
            <div class="music-info">
                <div class="music-item-title">${song.title}</div>
                <div class="music-item-artist">${song.artist}</div>
            </div>
            <button class="play-song-button" onclick="playTrack('${song.id}', '${token}')">
                <svg><use href="#play"></use></svg>
            </button>
        </div>
    `;
    musicList.innerHTML = songItem;

    document.getElementById('track-title').textContent = song.title;
    document.getElementById('track-artist').textContent = song.artist;
    document.getElementById('mini-cover-art').src = `/api/thumbnail/${song.id}?size=100`;
}

function playTrack(songId, token) {
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.src = `/api/stream?token=${token}`; // Assuming token is needed for stream
    audioPlayer.play();

    // Update Now Playing Info
    document.getElementById('track-title').textContent = document.getElementById(songId).querySelector('.music-item-title').textContent;
    document.getElementById('track-artist').textContent = document.getElementById(songId).querySelector('.music-item-artist').textContent;
    document.getElementById('mini-cover-art').src = document.getElementById(songId).querySelector('.cover-art').src;
}
