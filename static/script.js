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
    const miniCoverArt = document.getElementById('mini-cover-art');
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
    const dataScroll = document.getElementById('data-scroll');
    const musicListTitle = document.getElementById('music-list-title');
    const trackInfo = document.getElementById('track-info');

    let isPlaying = false;
    let openQueue = [];
    let queue = [];
    let currentTrack;
    let currentScreen = 'home';
    let shuffleedQueue = [];
    let isShuffle = false;
    let isRepeat = false;

    async function fetchAuth(url, options = {}) {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const headers = new Headers();

        headers.append('Authorization', `Bearer ${token}`);

        if (!(options.body instanceof FormData)) {
            headers.append('Content-Type', 'application/json');
        }


        if (options.headers) {
            options.headers = new Headers(options.headers);
            for (let [key, value] of headers.entries()) {
                options.headers.append(key, value);
            }
        } else {
            options.headers = headers;
        }


        const response = await fetch(url, options);
        if (response.status === 401) {
            window.location.href = '/login.html';
        }
        return response;
    }


    function savePlayerState() {
        localStorage.setItem('player-state', JSON.stringify({
            queue,
            currentTrack,
            isShuffle,
            isRepeat,
            volume: volumeSlider.value,
            currentTime: audioPlayer.currentTime,
            currentScreen
        }));
    }

    function loadPlayerState() {
        volumeSlider.style.setProperty('--value', '100%');
        const state = localStorage.getItem('player-state');
        if (state == null) return;

        nowPlayingContainer.classList.remove('not-playing');

        data = JSON.parse(state);

        openQueue = data.queue;
        currentTrack = data.currentTrack;
        isShuffle = data.isShuffle;
        isRepeat = data.isRepeat;
        volume = data.volume;
        const currentTime = parseInt(data.currentTime);
        currentScreen = data.currentScreen;

        volumeSlider.value = parseInt(volume);
        volumeSlider.style.setProperty('--value', volume + '%');

        if (isShuffle)
            shuffleButton.classList.toggle('active');
        if (isRepeat)
            repeatButton.classList.toggle('active');

        loadQueue();

        playTrack(currentTrack, false, false);
        audioPlayer.pause();

        isPlaying = false;
        playIcon.style.display = 'inline';
        pauseIcon.style.display = 'none';
        dataScroll.classList.remove('playing');

        coverArt.parentElement.classList.remove('hidden');
        dataScroll.parentElement.classList.remove('hidden');

        audioPlayer.currentTime = currentTime;
        currentTimeLabel.textContent = formatTime(currentTime);
        const duration = Math.floor(audioPlayer.duration);
        if (isNaN(duration)) return;
        durationLabel.textContent = formatTime(duration);
        const value = (currentTime / duration) * 1000;
        if (isNaN(value)) return;
        seekSlider.value = value;
        seekSlider.style.setProperty('--value', `${value / 10}%`);
    }

    String.prototype.toTitleCase = function () {
        return this.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
    }

    function volumeCurve(volume) {
        let value = (Math.pow(10, volume / 2500) - 1) * 10;
        if (value > 1) {
            return 1;
        } else if (value < 0) {
            return 0;
        }

        return value;
    }

    document.getElementById('upload-form').addEventListener('submit', async function (event) {
        event.preventDefault();

        // Check whether to use an existing or new playlist
        const playlistSelect = document.getElementById('playlist-select');
        let selectedPlaylistId = playlistSelect.value;
        const newPlaylistName = document.getElementById('new-playlist').value.trim();

        if (newPlaylistName) {
            const createResponse = await fetchAuth('/api/playlists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newPlaylistName })
            });

            if (createResponse.ok) {
                const playlist = await createResponse.json();
                selectedPlaylistId = playlist.id;
            } else {
                alert('Failed to create new playlist');
                return;
            }
        }

        const files = event.target.files.files;
        if (files.length === 0) {
            alert('Please select at least one file.');
            return;
        }

        document.getElementById('upload-progress').classList.remove('hidden');

        for (let i = 0; i < files.length; i++) {
            const fileProgress = document.getElementById('file-progress');
            fileProgress.textContent = `Uploading ${i + 1}/${files.length} files`;

            const formData = new FormData();
            formData.append('file', files[i]);

            const response = await fetchAuth('/api/music', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const result = await response.json();
                if (!result.error.includes("already exists")) {
                    alert('Failed to upload music: ' + (result.error || 'Unknown error'));
                } else {
                    const uploadedSong = result;
                    await addSongToPlaylist(selectedPlaylistId, uploadedSong.id);
                }
            } else {
                const uploadedSong = await response.json();
                await addSongToPlaylist(selectedPlaylistId, uploadedSong.id);
            }
        }

        document.getElementById('upload-progress').classList.add('hidden');
        loadMusicList();
        loadSidePlaylists();
    });

    createPlaylistForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const playlistName = event.target['playlist-name'].value;

        const response = await fetchAuth('/api/playlists', {
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
        const response = await fetchAuth('/api/playlists');
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

    async function addSongToPlaylist(playlistId, songId = null) {
        if (!songId) {
            songId = playlistMenu.dataset.songId;
        }

        const response = await fetchAuth(`/api/playlists/${playlistId}`);
        const playlist = await response.json();

        if (response.ok) {
            playlist.song_ids.push(songId);
            playlist.songs = playlist.song_ids;
            playlist.song_ids = undefined;

            const updateResponse = await fetchAuth(`/api/playlists/${playlistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(playlist)
            });

            if (updateResponse.ok) {
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
        const currentScreenElement = document.getElementById(currentScreen)
        if (currentScreenElement) {
            currentScreenElement.classList.remove('selected');
        }

        currentScreen = 'home';
        uploadSection.classList.add('hidden');
        searchSection.classList.add('hidden');
        musicSection.classList.remove('hidden');

        homeButton.classList.add('selected');
        searchButton.classList.remove('selected');
        uploadButton.classList.remove('selected');

        sidebar.classList.remove('active');

        loadMusicList();
    });

    uploadButton.addEventListener('click', () => {
        const currentScreenElement = document.getElementById(currentScreen)
        if (currentScreenElement) {
            currentScreenElement.classList.remove('selected');
        }

        currentScreen = 'upload';
        musicSection.classList.add('hidden');
        searchSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');

        uploadButton.classList.add('selected');
        searchButton.classList.remove('selected');
        homeButton.classList.remove('selected');

        sidebar.classList.remove('active');
    });

    searchButton.addEventListener('click', () => {
        const currentScreenElement = document.getElementById(currentScreen)
        if (currentScreenElement) {
            currentScreenElement.classList.remove('selected');
        }

        currentScreen = 'search';
        musicSection.classList.add('hidden');
        uploadSection.classList.add('hidden');
        searchSection.classList.remove('hidden');

        searchButton.classList.add('selected');
        uploadButton.classList.remove('selected');
        homeButton.classList.remove('selected');

        sidebar.classList.remove('active');
    });

    function loadMusic(musics, element = musicList, skip = 0) {
        openQueue = musics.slice();

        if (skip > 0) {
            musics = musics.slice(skip);
        } else {
            element.innerHTML = '';
        }

        musics.forEach(music => {
            const div = document.createElement('div');
            div.className = 'music-item';
            const ext = music.filename.split('.').pop().toUpperCase();
            const isHiFi = ext === 'FLAC' || ext === 'WAV' || ext === 'AIFF' || ext === 'ALAC' || ext === 'DSD';

            const isPlaying = currentTrack && currentTrack.id === music.id;

            if (music.color == "#000000") music.color = "#ffffff";

            div.style.setProperty('--art-color', music.color);

            artist = music.artist + (music.album_artist && music.artist != music.album_artist ? `, ${music.album_artist}` : '');
            artist = artist ? artist : 'Unknown Artist';

            div.innerHTML = `
                <img src="${`/api/thumbnail/${music.id}?size=160`}" alt="cover art" class="cover-art" loading="lazy">
                <div class="music-info">
                    <div class="music-item-title">${music.title} </div>
                    <div class="music-item-artist">${artist}</div>
                </div>
                ${isHiFi ? `<span class="hifi-tag">.${ext}</span>` : ''}
                <button id="add-to-playlist"><svg><use href="#plus"></use></svg></button>
            `;

            if (isPlaying) {
                div.classList.add('playing');
            }

            div.id = music.id;

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
        const response = await fetchAuth('/api/music?limit=20');
        const musics = await response.json();

        if (musics == null) {
            musicList.innerHTML = 'No music found';
            return;
        }

        musicListTitle.textContent = 'Recently Added';

        loadMusic(musics);
    }

    searchInput.addEventListener('input', async () => {
        const query = searchInput.value;
        if (query.length < 2) return;

        const response = await fetchAuth(`/api/search?q=${query}&limit=10`);
        const results = await response.json();

        if (results == null) {
            musicList.innerHTML = 'No music found';
            return;
        }

        searchResults.innerHTML = '';

        const playlistsDiv = document.createElement('div');
        playlistsDiv.className = 'search-results-playlists';
        playlistsDiv.classList.add('playlist-cards');
        const albumsDiv = document.createElement('div');
        albumsDiv.className = 'search-results-albums';
        const musicDiv = document.createElement('div');
        musicDiv.className = 'search-results-music';
        musicDiv.classList.add('music-list');

        const playlistsTitle = document.createElement('h2');
        playlistsTitle.textContent = 'Playlists';

        const albumsTitle = document.createElement('h2');
        albumsTitle.textContent = 'Albums';

        const musicTitle = document.createElement('h2');
        musicTitle.textContent = 'Music';

        searchResults.appendChild(playlistsTitle);
        searchResults.appendChild(playlistsDiv);
        searchResults.appendChild(albumsTitle);
        searchResults.appendChild(albumsDiv);
        searchResults.appendChild(musicTitle);
        searchResults.appendChild(musicDiv);

        const playlistResults = results.playlists;
        const albumResults = results.albums;
        const musicResults = results.songs;

        if (playlistResults == null) {
            playlistsDiv.innerHTML = 'No playlists found';
        } else {
            loadPlaylists(playlistResults, playlistsDiv);
        }

        if (albumResults == null) {
            albumsDiv.innerHTML = 'No albums found';
        } else {
            loadAlbums(albumResults, albumsDiv);
        }

        if (musicResults == null) {
            musicDiv.innerHTML = 'No music found';
        } else {
            musicListTitle.textContent = 'Search Results';
            loadMusic(musicResults, musicDiv);
        }
    });

    function updateScrollingBanner(text) {
        dataScroll.innerHTML = `<span>${text} • &zwnj;</span><span id="num2">${text} • &zwnj;</span><span id="num3">${text} • &zwnj;</span><span id="num4">${text} • &zwnj;</span>`;
    }

    async function fetchStreamToken(musicId) {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch(`/api/streamtoken/${musicId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch stream token');
        }

        const data = await response.json();
        return data.token;
    }

    async function playTrack(music, isUserAction = true, play = true) {
        const streamToken = await fetchStreamToken(music.id);
        audioPlayer.src = `/api/stream?token=${streamToken}`;

        const thumbnailUrl = `/api/thumbnail/${music.id}?size=600`;
        const miniThumbnailUrl = `/api/thumbnail/${music.id}?size=160`;
        coverArt.src = thumbnailUrl;
        coverArt.alt = music.title;
        miniCoverArt.src = miniThumbnailUrl;
        miniCoverArt.alt = music.title;
        trackTitle.textContent = music.title;
        artist = music.artist + (music.album_artist && music.artist != music.album_artist ? `, ${music.album_artist}` : '');
        artist = artist ? artist : 'Unknown Artist';
        trackArtist.textContent = artist;
        audioPlayer.currentTime = 0;
        seekSlider.value = 0;
        seekSlider.style.setProperty('--value', `0%`);
        audioPlayer.volume = volumeCurve(volumeSlider.value);
        if (play) {
            audioPlayer.play();
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
            isPlaying = true;
        }
        if (currentTrack) {
            const div = document.getElementById(currentTrack.id);
            if (div) {
                div.classList.remove('playing');
            }
        }

        currentTrack = music;

        const currentDiv = document.getElementById(music.id);
        if (currentDiv) {
            currentDiv.classList.add('playing');
        }

        if (isUserAction)
            loadQueue();

        coverArt.parentElement.classList.remove('hidden');
        dataScroll.parentElement.classList.remove('hidden');

        if (music.color == "#000000") music.color = "#ffffff";

        nowPlayingContainer.style.setProperty('--art-color', music.color);

        const audioControls = document.getElementById('audio-controls');
        trackInfo.style.setProperty('max-width', `${audioControls.getBoundingClientRect().left - 50}px`);

        if (trackInfo.scrollWidth > trackInfo.clientWidth) {
            trackInfo.classList.add("track-info-gradient");
        } else {
            trackInfo.classList.remove("track-info-gradient");
        }

        // fetch song from id if missing year, album, genre
        if (music.year == 0 || !music.album || !music.genre) {
            const response = await fetchAuth(`/api/music/${music.id}`);
            const song = await response.json();
            music = song;
        }

        let info = [];

        if (!(music.year == 0))
            info.push(music.year);

        info.push(music.album);

        const ext = music.filename.split('.').pop().toUpperCase();
        info.push(`.${ext.toUpperCase()}`);

        const isLossless = ext === 'FLAC' || ext === 'WAV' || ext === 'AIFF' || ext === 'ALAC' || ext === 'DSD';
        info.push(isLossless ? 'Lossless' : 'Lossy');

        const genre = music.genre.split(',')[0].toTitleCase();
        if (genre)
            info.push(genre);

        const infoBanner = info.join(' • ');
        updateScrollingBanner(infoBanner);

        if (play) {
            dataScroll.classList.add('playing');
        }

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: music.title,
                artist: music.artist,
                album: music.album,
                artwork: [{ src: thumbnailUrl, sizes: '600x600', type: 'image/jpeg' }]
            });
        }

        savePlayerState();

        audioPlayer.onended = playNextTrack;
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
            audioPlayer.play();
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
            isPlaying = true;
            dataScroll.classList.add('playing');
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            audioPlayer.pause();
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
            isPlaying = false;
            dataScroll.classList.remove('playing');
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            playPreviousTrack();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            playNextTrack();
        });
    }

    //FIX?ME: Queue get reset weirdly. could not reproduce the bug

    function loadQueue() {
        queue = openQueue.slice();
        shuffleQueue();
    }

    function shuffleQueue() {
        const artistMap = {};

        shuffleedQueue = queue.slice();
        shuffleedQueue.sort(() => Math.random() - 0.5);

        shuffleedQueue.forEach(song => {
            if (!artistMap[song.artist]) {
                artistMap[song.artist] = [];
            }
            artistMap[song.artist].push(song);
        });

        const artistGroups = Object.values(artistMap);

        artistGroups.sort((a, b) => b.length - a.length);

        const smartShuffledQueue = [];
        let groupIndex = 0;

        while (artistGroups.some(group => group.length > 0)) {
            for (let i = 0; i < artistGroups.length; i++) {
                if (artistGroups[i].length > 0) {
                    smartShuffledQueue.push(artistGroups[i].shift());
                    groupIndex++;
                }
            }
        }

        shuffleedQueue = smartShuffledQueue;
    }


    function getCurrentIndex() {
        let currentIndex;
        if (isShuffle) {
            currentIndex = shuffleedQueue.findIndex(m => m.id === currentTrack.id);
        } else {
            currentIndex = queue.findIndex(m => m.id === currentTrack.id);
        }
        return currentIndex;
    }

    function playNextTrack() {
        let currentIndex = getCurrentIndex();

        if (isRepeat) {
            playTrack(queue[currentIndex], false);
            return;
        }

        if (isShuffle) {
            currentIndex = (currentIndex + 1) % shuffleedQueue.length;
            playTrack(shuffleedQueue[currentIndex], false);
        } else {
            currentIndex = (currentIndex + 1) % queue.length;
            playTrack(queue[currentIndex], false);
        }
    }

    function playPreviousTrack() {
        let currentIndex = getCurrentIndex();

        if (audioPlayer.currentTime > 5) {
            audioPlayer.currentTime = 0;
            return;
        }

        if (isShuffle) {
            currentIndex = currentIndex - 1 < 0 ? shuffleedQueue.length - 1 : currentIndex - 1;
            playTrack(shuffleedQueue[currentIndex], false);
        } else {
            currentIndex = currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1;
            playTrack(queue[currentIndex], false);
        }
    }


    playPauseButton.addEventListener('click', () => {
        if (isPlaying) {
            audioPlayer.pause();
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
            dataScroll.classList.remove('playing');
        } else {
            audioPlayer.play();
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
            dataScroll.classList.add('playing');
        }

        isPlaying = !isPlaying;

        savePlayerState();
    });

    prevButton.addEventListener('click', () => {
        if (isRepeat) {
            isRepeat = !isRepeat;
            repeatButton.classList.toggle('active');
        }
        playPreviousTrack();
    });

    nextButton.addEventListener('click', () => {
        if (isRepeat) {
            isRepeat = !isRepeat;
            repeatButton.classList.toggle('active');
        }
        playNextTrack();
    });

    shuffleButton.addEventListener('click', () => {
        isShuffle = !isShuffle;
        shuffleButton.classList.toggle('active');
        shuffleQueue();
        savePlayerState();
    });

    repeatButton.addEventListener('click', () => {
        isRepeat = !isRepeat;
        repeatButton.classList.toggle('active');
        savePlayerState();
    });

    volumeSlider.addEventListener('input', () => {
        audioPlayer.volume = volumeCurve(volumeSlider.value);
        volumeSlider.style.setProperty('--value', `${volumeSlider.value}%`);

        savePlayerState();
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

        savePlayerState();
    });


    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;
        return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
    }

    function loadPlaylists(playlists, element = playlistsList) {
        element.innerHTML = '';
        playlists.forEach(async playlist => {
            const div = document.createElement('div');
            div.className = 'playlist-item';

            const playlistArt = document.createElement('div');
            playlistArt.className = 'playlist-item-art';
            div.appendChild(playlistArt);

            const playlistInfo = document.createElement('div');
            playlistInfo.className = 'playlist-item-info';
            playlistInfo.innerHTML = `
            <div class="playlist-info">
                <div class="playlist-item-title">${playlist.name}</div>
                <div class="playlist-item-count">${playlist.songs.length} songs</div>
            </div>
            `;

            div.appendChild(playlistInfo);

            div.addEventListener('click', () => {
                loadPlaylist(playlist.id);
            });

            const songIDs = playlist.songs.slice(0, 4);
            if (songIDs.length < 4) {
                for (let i = songIDs.length; i < 4; i++) {
                    songIDs.push(0);
                }
            }

            let i = 0;

            songIDs.forEach(async songID => {
                if (songID == 0) {
                    const img = document.createElement('img');
                    img.src = `/api/thumbnail/0?size=160`;
                    playlistArt.appendChild(img);
                    div.style.setProperty('--art-color' + i, '#000000');
                    i++;
                } else {
                    const response = await fetchAuth(`/api/music/${songID}`);
                    const song = await response.json();

                    if (i == 0) {
                        div.style.setProperty('--art-color', song.color);
                    }

                    const img = document.createElement('img');
                    img.src = `/api/thumbnail/${song.id}?size=160`;
                    img.alt = song.title;
                    playlistArt.appendChild(img);
                    i++;
                }
            });

            element.appendChild(div);
        });
    }

    async function loadSidePlaylists() {
        const response = await fetchAuth('/api/user/playlists');
        const playlistSelect = document.getElementById('playlist-select');
        const playlists = await response.json();

        if (playlists == null) {
            playlistsList.innerHTML = '<li>No playlists found</li>';
            return;
        }

        playlistsList.innerHTML = '';

        playlists.forEach(playlist => {
            const button = document.createElement('button');
            button.id = playlist.id;
            button.textContent = playlist.name;
            button.addEventListener('click', () => {
                loadPlaylist(playlist.id);
                sidebar.classList.remove('active');
            });
            playlistsList.appendChild(button);

            const option = document.createElement('option');
            option.value = playlist.id;
            option.textContent = playlist.name;
            playlistSelect.appendChild(option);

        });
    }

    async function loadPlaylist(playlistId, isAlbum = false) {
        const currentScreenElement = document.getElementById(currentScreen)
        if (currentScreenElement) {
            currentScreenElement.classList.remove('selected');
        }

        currentScreen = playlistId;
        uploadSection.classList.add('hidden');
        searchSection.classList.add('hidden');
        musicSection.classList.remove('hidden');

        homeButton.classList.remove('selected');
        searchButton.classList.remove('selected');
        uploadButton.classList.remove('selected');

        const playlistSide = document.getElementById(playlistId)
        if (playlistSide) {
            playlistSide.classList.add('selected');
        }

        let response;

        if (!isAlbum) {
            response = await fetchAuth(`/api/playlists/${playlistId}?limit=40`);
        } else {
            response = await fetchAuth(`/api/albums/${playlistId}`);
        }
        const playlist = await response.json();

        if (playlist == null) {
            return;
        }

        musicListTitle.textContent = playlist.name;

        //Get the songs from the playlist from IDs
        let songs = [];
        if (!isAlbum) {
            // for (let i = 0; i < playlist.song_ids.length; i++) {
            //     const response = await fetchAuth(`/api/music/${playlist.song_ids[i]}`);
            //     const song = await response.json();
            //     songs.push(song);
            // }

            songs = playlist.songs;

            musicListTitle.textContent = playlist.name;
        } else {
            for (let i = 0; i < playlist.songs.length; i++) {
                const response = await fetchAuth(`/api/music/${playlist.songs[i]}`);
                const song = await response.json();
                songs.push(song);
            }

            musicListTitle.textContent = playlist.title;
        }

        loadMusic(songs);

        if (!isAlbum) {
            response = await fetchAuth(`/api/playlists/${playlistId}?offset=40`);
            const playlist = await response.json();

            if (playlist == null) {
                return;
            }

            loadMusic(playlist.songs, musicList, 40);
        }
    }

    // loadAlbums like loadPlaylists cards
    function loadAlbums(albums, element = albumsList) {
        element.innerHTML = '';
        albums.forEach(async album => {
            const div = document.createElement('div');
            div.className = 'playlist-item';

            const playlistArt = document.createElement('div');
            playlistArt.className = 'album-item-art';
            div.appendChild(playlistArt);

            const playlistInfo = document.createElement('div');
            playlistInfo.className = 'playlist-item-info';
            playlistInfo.innerHTML = `
            <div class="playlist-info">
                <div class="playlist-item-title">${album.title}</div>
                <div class="playlist-item-artist">${album.artist}</div>
                <div class="playlist-item-count">${album.songs.length} songs</div>
            </div>
            `;

            div.appendChild(playlistInfo);

            div.addEventListener('click', () => {
                loadPlaylist(album.id, true);
            });

            const songID = album.songs[0];

            const response = await fetchAuth(`/api/music/${songID}`);
            const song = await response.json();

            const img = document.createElement('img');
            img.src = `/api/thumbnail/${song.id}?size=600`;
            img.alt = song.title;
            playlistArt.appendChild(img);

            div.style.setProperty('--art-color', song.color);

            element.appendChild(div);
        });
    }

    seekSlider.style.setProperty('--value', '0%');

    loadPlayerState();
    loadSidePlaylists();
    loadMusicList();
});

// On window resize, set max-width for track info based on position of media controls
window.addEventListener('resize', () => {
    const trackInfo = document.getElementById('track-info');
    const audioControls = document.getElementById('audio-controls');
    trackInfo.style.setProperty('max-width', `${audioControls.getBoundingClientRect().left - 50}px`);

    if (trackInfo.scrollWidth > trackInfo.clientWidth) {
        trackInfo.classList.add("track-info-gradient");
    } else {
        trackInfo.classList.remove("track-info-gradient");
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const sidebar = document.getElementById("sidebar");
    const toggleButton = document.getElementById("sidebar-toggle");

    // Toggle the sidebar on mobile when the button is clicked
    toggleButton.addEventListener("click", function () {
        sidebar.classList.toggle("active");
    });
});

document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("donation-modal");
    const closeModalBtn = document.getElementById("close-modal-btn");

    closeModalBtn.addEventListener("click", function () {
        modal.style.display = "none";
    });

    // If you want to hide the modal after a certain period, you can use a timeout
    setTimeout(function () {
        modal.style.display = "none";
    }, 10000); // 10 seconds (adjust as needed)
});
