document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const uploadProgress = document.getElementById('upload-progress');
    const fileProgress = document.getElementById('file-progress');
    const musicList = document.getElementById('music-list');
    const audioPlayer = document.getElementById('audio-player');
    const playPauseButton = document.getElementById('play-pause');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    const shuffleButton = document.getElementById('shuffle-button');
    const repeatButton = document.getElementById('repeat-button');
    const seekSlider = document.getElementById('seek-slider');
    const volumeSlider = document.getElementById('volume-slider');
    const currentTimeLabel = document.getElementById('current-time');
    const durationLabel = document.getElementById('duration');
    const coverArt = document.getElementById('cover-art');
    const trackTitle = document.getElementById('track-title');
    const trackArtist = document.getElementById('track-artist');
    const nowPlayingContainer = document.getElementById('now-playing-container');

    let isPlaying = false;
    let currentTrack = null;



    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const files = event.target.files.files;  // get the files from the input
        if (files.length === 0) {
            alert('Please select at least one file.');
            return;
        }

        uploadProgress.classList.remove('hidden');

        for (let i = 0; i < files.length; i++) {
            fileProgress.textContent = `Uploading ${i + 1}/${files.length} files`;
            const formData = new FormData();
            formData.append('file', files[i]);

            const response = await fetch('/api/music', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const result = await response.json();
                alert('Failed to upload music: ' + (result.error || 'Unknown error'));
                break;
            }
        }

        uploadProgress.classList.add('hidden');
        alert('All music files uploaded successfully!');
        loadMusicList();
    });

    function loadMusic(musics) {
        musicList.innerHTML = '';
        musics.forEach(music => {
            const div = document.createElement('div');
            div.className = 'music-item';
            const ext = music.filename.split('.').pop().toUpperCase();
            const isHiFi = ext === 'FLAC' || ext === 'WAV' || ext === 'AIFF' || ext === 'ALAC' || ext === 'DSD';

            div.style.setProperty('--art-color', music.color);

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

    async function loadMusicList() {
        const response = await fetch('/api/music');
        const musics = await response.json();

        if (musics == null) {
            musicList.innerHTML = '<li>No music found</li>';
            return;
        }

        loadMusic(musics);
    }

    function playTrack(music) {
        audioPlayer.src = `/api/stream/${music.id}`;
        coverArt.src = `/api/thumbnail/${music.id}`;
        coverArt.alt = music.title;
        trackTitle.textContent = music.title;
        trackArtist.textContent = music.artist;
        audioPlayer.play();
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'inline';
        isPlaying = true;
        currentTrack = music;

        nowPlayingContainer.classList.remove('not-playing');

        if (music.color == "#000000") music.color = "#ffffff";

        nowPlayingContainer.style.setProperty('--art-color', music.color);
    }

    playPauseButton.addEventListener('click', () => {
        if (isPlaying) {
            audioPlayer.pause();
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
        } else {
            audioPlayer.play();
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
        }
        isPlaying = !isPlaying;
    });

    prevButton.addEventListener('click', () => {
        //TODO: Implement this
    });

    nextButton.addEventListener('click', () => {
        //TODO: Implement this
    });

    shuffleButton.addEventListener('click', () => {
        //TODO: Implement this
    });

    repeatButton.addEventListener('click', () => {
        //TODO: Implement this
    });

    volumeSlider.addEventListener('input', () => {
        audioPlayer.volume = volumeSlider.value / 100;
        volumeSlider.style.setProperty('--value', `${volumeSlider.value}%`);
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
        if (isNaN(duration)) return;
        durationLabel.textContent = formatTime(duration);
        const currentTime = Math.floor(audioPlayer.currentTime);
        const value = (currentTime / duration) * 1000;
        if (isNaN(value)) return;
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



    const newPlaylistBtn = document.getElementById('new-playlist-btn');
    const playlistsList = document.getElementById('playlists-list');
    const albumsList = document.getElementById('albums-list');

    newPlaylistBtn.addEventListener('click', () => {
        const playlistName = prompt('Enter playlist name:');
        if (playlistName) {
            createPlaylist(playlistName);
        }
    });

    async function createPlaylist(name) {
        const response = await fetch('/api/playlists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            loadPlaylists();
        } else {
            alert('Failed to create playlist.');
        }
    }

    async function loadPlaylists() {
        const response = await fetch('/api/playlists');
        const playlists = await response.json();

        if (playlists == null) {
            playlistsList.innerHTML = '<li>No playlists found</li>';
            return;
        }

        playlistsList.innerHTML = '';
        playlists.forEach(playlist => {
            const li = document.createElement('li');
            li.textContent = playlist.name;
            li.addEventListener('click', () => {
                loadPlaylist(playlist.id);
            });
            playlistsList.appendChild(li);
        });
    }

    async function loadPlaylist(playlistId) {
        const response = await fetch(`/api/playlists/${playlistId}`);
        const playlist = await response.json();

        musicList.innerHTML = '';
        playlist.tracks.forEach(track => {
            const div = document.createElement('div');
            div.className = 'music-item';

            div.innerHTML = `
                <img src="${`/api/thumbnail/${track.id}?size=80`}" alt="cover art" class="cover-art">
                <div class="music-info">
                    <div class="music-item-title">${track.title} </div>
                    <div class="music-item-artist">${track.artist}</div>
                </div>
            `;
            div.addEventListener('click', () => {
                playTrack(track);
            });
            musicList.appendChild(div);
        });
    }

    seekSlider.style.setProperty('--value', '0%');
    volumeSlider.style.setProperty('--value', '100%');

    loadPlaylists();
    loadMusicList();
});