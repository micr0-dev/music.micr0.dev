document.getElementById('upload-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const response = await fetch('/api/music', {
        method: 'POST',
        body: formData,
    });
    const result = await response.json();
    if (response.ok) {
        alert('Music uploaded successfully!');
        loadMusicList();
    } else {
        alert('Failed to upload music: ' + result.error);
    }
});

async function loadMusicList() {
    const response = await fetch('/api/music');
    const musics = await response.json();
    const musicList = document.getElementById('music-list');
    musicList.innerHTML = '';
    musics.forEach(music => {
        const div = document.createElement('div');
        div.className = 'music-item';
        div.textContent = `${music.title} by ${music.artist}`;
        div.onclick = () => {
            const audioPlayer = document.getElementById('audio-player');
            audioPlayer.src = `/api/stream/${music.id}`;
            audioPlayer.play();
        };
        musicList.appendChild(div);
    });
}

loadMusicList();