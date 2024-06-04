document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const musicList = document.getElementById('music-list');
    const audioPlayer = document.getElementById('audio-player');
    const playPauseButton = document.getElementById('play-pause');
    const seekSlider = document.getElementById('seek-slider');
    const currentTimeLabel = document.getElementById('current-time');
    const durationLabel = document.getElementById('duration');
    const coverArt = document.getElementById('cover-art');
    const trackTitle = document.getElementById('track-title');
    const trackArtist = document.getElementById('track-artist');

    let isPlaying = false;
    let currentTrack = null;

    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        document.getElementById('upload-progress').classList.remove('hidden');
        const response = await fetch('/api/music', {
            method: 'POST',
            body: formData,
        });
        const result = await response.json();
        document.getElementById('upload-progress').classList.add('hidden');
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
            const ext = music.filename.split('.').pop().toUpperCase();
            const isHiFi = ext === 'FLAC' || ext === 'WAV' || ext === 'AIFF' || ext === 'ALAC' || ext === 'DSD';

            coverArt.style.setProperty('--art-color', music.avrageColor);

            div.innerHTML = `
                <img src="${`/api/thumbnail/${music.id}?size=80`}" alt="cover art" class="cover-art">
                <div class="music-info">
                    <div class="music-item-title">${music.title} </div>
                    <div class="music-item-artist">${music.artist}</div>
                </div>
                ${isHiFi ? `<span class="hifi-tag">.${ext}</span>` : ''}
            `;
            div.addEventListener('click', () => {
                playTrack(music);
            });
            musicList.appendChild(div);
        });
    }

    function playTrack(music) {
        audioPlayer.src = `/api/stream/${music.id}`;
        coverArt.src = `/api/thumbnail/${music.id}`;
        coverArt.alt = music.title;
        trackTitle.textContent = music.title;
        trackArtist.textContent = music.artist;
        audioPlayer.play();
        isPlaying = true;
        playPauseButton.textContent = 'Pause';
        currentTrack = music;

        coverArt.style.setProperty('--art-color', music.avrageColor);
    }

    playPauseButton.addEventListener('click', () => {
        if (isPlaying) {
            audioPlayer.pause();
            playPauseButton.textContent = 'Play';
        } else {
            audioPlayer.play();
            playPauseButton.textContent = 'Pause';
        }
        isPlaying = !isPlaying;
    });

    let isDragging = false;

    seekSlider.addEventListener('input', () => {
        if (!isDragging) return;

        const duration = Math.floor(audioPlayer.duration);
        const progress = seekSlider.value / 10;
        seekSlider.style.setProperty('--value', `${progress}%`);
    });

    seekSlider.addEventListener('mousedown', () => {
        isDragging = true;
    });

    seekSlider.addEventListener('mouseup', () => {
        if (!isDragging) return;

        isDragging = false;
        const duration = Math.floor(audioPlayer.duration);
        audioPlayer.currentTime = (seekSlider.value / 1000) * duration;

        currentTimeLabel.textContent = formatTime(Math.floor(audioPlayer.currentTime));

        const progress = seekSlider.value / 10;
        seekSlider.style.setProperty('--value', `${progress}%`);
    });

    audioPlayer.addEventListener('timeupdate', () => {
        if (isDragging) return;

        const duration = Math.floor(audioPlayer.duration);
        const currentTime = Math.floor(audioPlayer.currentTime);
        const value = (currentTime / duration) * 1000;
        seekSlider.value = value;

        currentTimeLabel.textContent = formatTime(Math.floor(audioPlayer.currentTime));

        const progress = value / 10;
        seekSlider.style.setProperty('--value', `${progress}%`);
    });


    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;
        return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
    }

    loadMusicList();

    seekSlider.style.setProperty('--value', '0%');
});