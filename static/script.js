document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const uploadProgress = document.getElementById('upload-progress');
    const fileProgress = document.getElementById('file-progress');
    const musicList = document.getElementById('music-list');
    const playlistsList = document.getElementById('playlists-list');
    const playlistMenu = document.getElementById('playlist-menu');
    const existingPlaylists = document.getElementById('existing-playlists');
    const createPlaylistForm = document.getElementById('create-playlist-form');
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
    const homeButton = document.getElementById('home-button');
    const searchButton = document.getElementById('search-button');
    const uploadButton = document.getElementById('upload-button');
    const uploadSection = document.getElementById('upload-section');
    const searchSection = document.getElementById('search-section');
    const musicSection = document.getElementById('music-list-section');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    let isPlaying = false;
    let currentTrack = null;
    let currentScreen = 'home';
    let openQueue = [];
    let queue = [];
    let currentIndex = 0;
    let isShuffle = false;
    let isRepeat = false;

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

    createPlaylistForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const playlistName = event.target['playlist-name'].value;

        const response = await fetch('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: playlistName })
        });

        const result = await response.json();
        if (response.ok) {
            await fetchPlaylists();
            const playlistId = result.id;
            addSongToPlaylist(playlistId);
        } else {
            alert('Failed to create playlist: ' + result.error);
        }
    });

    async function fetchPlaylists() {
        const response = await fetch('/api/playlists');
        const playlists = await response.json();

        existingPlaylists.innerHTML = '';
        playlists.forEach(playlist => {
            const div = document.createElement('div');
            div.className = 'playlist-item';
            div.textContent = playlist.name;
            div.addEventListener('click', () => {
                addSongToPlaylist(playlist.id);
            });
            existingPlaylists.appendChild(div);
        });
    }

    function showPlaylistMenu(songId) {
        playlistMenu.classList.remove('hidden');
        playlistMenu.dataset.songId = songId;
        fetchPlaylists();
    }

    async function addSongToPlaylist(playlistId) {
        const songId = playlistMenu.dataset.songId;

        const response = await fetch(`/api/playlists/${playlistId}`);
        const playlist = await response.json();

        if (response.ok) {
            playlist.song_ids.push(songId);
            playlist.songs = playlist.song_ids;
            playlist.song_ids = undefined;

            const updateResponse = await fetch(`/api/playlists/${playlistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(playlist)
            });

            if (updateResponse.ok) {
                alert('Song added to playlist successfully!');
                playlistMenu.classList.add('hidden');
            } else {
                const result = await updateResponse.json();
                alert('Failed to update playlist: ' + result.error);
            }
        } else {
            alert('Failed to fetch playlist');
        }
    }

    //Sidebar navigation
    homeButton.addEventListener('click', () => {
        currentScreen = 'home';
        uploadSection.classList.add('hidden');
        searchSection.classList.add('hidden');
        musicSection.classList.remove('hidden');

        homeButton.classList.add('selected');
        searchButton.classList.remove('selected');
        uploadButton.classList.remove('selected');

        loadMusicList();
    });

    uploadButton.addEventListener('click', () => {
        currentScreen = 'upload';
        musicSection.classList.add('hidden');
        searchSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');

        uploadButton.classList.add('selected');
        searchButton.classList.remove('selected');
        homeButton.classList.remove('selected');
    });

    searchButton.addEventListener('click', () => {
        currentScreen = 'search';
        musicSection.classList.add('hidden');
        uploadSection.classList.add('hidden');
        searchSection.classList.remove('hidden');

        searchButton.classList.add('selected');
        uploadButton.classList.remove('selected');
        homeButton.classList.remove('selected');
    });

    function loadMusic(musics, element = musicList) {
        openQueue = musics;

        element.innerHTML = '';
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
                <button id="add-to-playlist"><svg><use href="#plus"></use></svg></button>
            `;
            div.addEventListener('click', () => {
                playTrack(music);
            });

            const addToPlaylistBtn = div.querySelector('#add-to-playlist');
            addToPlaylistBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                showPlaylistMenu(music.id);
            });

            element.appendChild(div);
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

    searchInput.addEventListener('input', async () => {
        const query = searchInput.value;
        if (query.length < 3) return;

        const response = await fetch(`/api/search?q=${query}`);
        const results = await response.json();

        if (results == null) {
            musicList.innerHTML = 'No music found';
            return;
        }

        searchResults.innerHTML = '';

        const playlistsDiv = document.createElement('div');
        playlistsDiv.className = 'search-results-playlists';
        const musicDiv = document.createElement('div');
        musicDiv.className = 'search-results-music';
        musicDiv.classList.add('music-list');

        const playlistsTitle = document.createElement('h2');
        playlistsTitle.textContent = 'Playlists';

        const musicTitle = document.createElement('h2');
        musicTitle.textContent = 'Music';

        searchResults.appendChild(playlistsTitle);
        searchResults.appendChild(playlistsDiv);
        searchResults.appendChild(musicTitle);
        searchResults.appendChild(musicDiv);

        const playlistResults = results.playlists;
        const musicResults = results.songs;

        if (playlistResults == null) {
            playlistsDiv.innerHTML = 'No playlists found';
        } else {
            loadPlaylists(playlistResults, playlistsDiv);
        }

        if (musicResults == null) {
            musicDiv.innerHTML = 'No music found';
        } else {
            loadMusic(musicResults, musicDiv);
        }
    });

    function playTrack(music, isUserAction = true) {
        audioPlayer.src = `/api/stream/${music.id}`;
        const thumbnailUrl = `/api/thumbnail/${music.id}`;
        coverArt.src = thumbnailUrl;
        coverArt.alt = music.title;
        trackTitle.textContent = music.title;
        trackArtist.textContent = music.artist;
        audioPlayer.play();
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'inline';
        isPlaying = true;
        currentTrack = music;

        const index = openQueue.findIndex(m => m.id === music.id);

        if (isUserAction)
            loadQueue(index);

        nowPlayingContainer.classList.remove('not-playing');

        if (music.color == "#000000") music.color = "#ffffff";

        nowPlayingContainer.style.setProperty('--art-color', music.color);

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: music.title,
                artist: music.artist,
                album: 'Album Name',
                artwork: [{ src: thumbnailUrl, sizes: '300x300', type: 'image/jpeg' }]
            });
        }

        audioPlayer.onended = playNextTrack;
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
            audioPlayer.play();
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
            isPlaying = true;
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            audioPlayer.pause();
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
            isPlaying = false;
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            playPreviousTrack();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            playNextTrack();
        });
    }

    function loadQueue(index) {
        queue = openQueue.slice();
        currentIndex = index;
    }

    function playNextTrack() {
        if (isRepeat) {
            playTrack(queue[currentIndex], false);
            return;
        }

        if (isShuffle) {
            currentIndex = Math.floor(Math.random() * queue.length);
        } else {
            currentIndex = (currentIndex + 1) % queue.length;
        }
        playTrack(queue[currentIndex], false);
    }

    function playPreviousTrack() {
        if (audioPlayer.currentTime > 5) {
            audioPlayer.currentTime = 0;
            return;
        }

        if (isShuffle) {
            currentIndex = Math.floor(Math.random() * queue.length);
        } else {
            currentIndex = (currentIndex - 1 + queue.length) % queue.length;
        }
        playTrack(queue[currentIndex], false);
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
        playPreviousTrack();
    });

    nextButton.addEventListener('click', () => {
        playNextTrack();
    });

    shuffleButton.addEventListener('click', () => {
        isShuffle = !isShuffle;
        shuffleButton.classList.toggle('active');
    });

    repeatButton.addEventListener('click', () => {
        isRepeat = !isRepeat;
        repeatButton.classList.toggle('active');
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

    async function loadPlaylists(playlists, element = playlistsList) {
        element.innerHTML = '';
        playlists.forEach(playlist => {
            const li = document.createElement('li');
            li.textContent = playlist.name;
            li.addEventListener('click', () => {
                loadPlaylist(playlist.id);
            });
            element.appendChild(li);
        });
    }

    async function loadSidePlaylists() {
        const response = await fetch('/api/playlists');
        const playlists = await response.json();

        if (playlists == null) {
            playlistsList.innerHTML = '<li>No playlists found</li>';
            return;
        }

        loadPlaylists(playlists);
    }



    async function loadPlaylist(playlistId) {
        const response = await fetch(`/api/playlists/${playlistId}`);
        const playlist = await response.json();

        if (playlist == null) {
            albumsList.innerHTML = 'No music found';
            return;
        }

        loadMusic(playlist.songs);
    }

    seekSlider.style.setProperty('--value', '0%');
    volumeSlider.style.setProperty('--value', '100%');

    loadSidePlaylists();
    loadMusicList();
});