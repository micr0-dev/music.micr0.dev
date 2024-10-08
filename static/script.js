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
    const wholePlaylistsList = document.getElementById('whole-playlists-list');
    const wholePlaylistsListTitle = document.getElementById('whole-playlists-title');
    const recentPlaylists = document.getElementById('recent-playlists');

    let isPlaying = false;
    let openQueue = [];
    let queue = [];
    let currentTrack;
    let currentScreen = 'home';
    let shuffleedQueue = [];
    let isShuffle = false;
    let isRepeat = false;

    async function fetchAuth (url, options = {}) {
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

    function customAlert (message) {
        const toastContainer = document.getElementById('toast-container');

        if (!toastContainer) {
            console.error('Toast container not found.');
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Show the toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Hide and remove the toast after 2 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 300);
        }, 2000);
    }

    // Overwrite the default alert function
    window.alert = customAlert;

    function savePlayerState () {
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

    function loadPlayerState () {
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

    function volumeCurve (volume) {
        let value = (Math.pow(10, volume / 2500) - 1) * 10;
        if (value > 1) {
            return 1;
        } else if (value < 0) {
            return 0;
        }

        return value;
    }

    function checkColorTooDark (color) {
        const c = color.substring(1);      // strip #
        const rgb = parseInt(c, 16);   // convert rrggbb to decimal
        const r = (rgb >> 16) & 0xff;  // extract red
        const g = (rgb >> 8) & 0xff;  // extract green
        const b = (rgb >> 0) & 0xff;  // extract blue

        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709

        return luma < 16;
    }

    function Lighten (color) {
        let num = parseInt(color, 16),
            amt = 45,
            R = (num >> 16) + amt,
            B = ((num >> 8) & 0x00FF) + amt,
            G = (num & 0x0000FF) + amt;

        let newColor = G | (B << 8) | (R << 16);
        return "#" + newColor.toString(16);
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
                if (!result.error.includes("lower quality than the existing one")) {
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
            loadSidePlaylists();
        } else {
            alert('Failed to create playlist: ' + result.error);
        }
    });

    async function fetchPlaylists () {
        const response = await fetchAuth('/api/user/playlists');
        const playlists = await response.json();

        existingPlaylists.innerHTML = '';
        playlists.forEach(playlist => {
            const button = document.createElement('button');
            button.className = 'playlist-select-item';
            button.textContent = playlist.name;
            button.addEventListener('click', () => {
                addSongToPlaylist(playlist.id);
            });
            existingPlaylists.appendChild(button);
        });
    }

    function showPlaylistMenu (song) {
        playlistMenu.classList.remove('menu-hidden');
        playlistMenu.dataset.songId = song.id;
        playlistMenu.querySelector('h2').textContent = "Add to Playlist";
        playlistMenu.style.setProperty('--art-color', song.color);

        const rect = playlistMenu.getBoundingClientRect();
        let x = event.clientX;
        let y = event.clientY;

        x = Math.min(x, window.innerWidth - rect.width - 10);
        y = Math.min(y, window.innerHeight - rect.height - 10);
        x = Math.max(x, 10);
        y = Math.max(y, 10);

        playlistMenu.style.left = `${x}px`;
        playlistMenu.style.top = `${y}px`;

        document.addEventListener('click', function hideMenu (event) {
            if (!playlistMenu.contains(event.target)) {
                playlistMenu.classList.add('menu-hidden');
                document.removeEventListener('click', hideMenu);
            }
        });

        let isMouseOver = true;

        function resetTimer () {
            isMouseOver = true;

        }

        function hideMenu () {
            isMouseOver = false;
            setTimeout(() => {
                if (!isMouseOver) {
                    playlistMenu.classList.add('menu-hidden');
                    playlistMenu.removeEventListener('mouseleave', hideMenu);
                    playlistMenu.removeEventListener('mouseenter', resetTimer);
                }
            }, 500);
        }

        playlistMenu.addEventListener('mouseleave', hideMenu);

        playlistMenu.addEventListener('mouseenter', resetTimer);

        fetchPlaylists();
    }

    async function addSongToPlaylist (playlistId, songId = null) {
        if (!songId) {
            songId = playlistMenu.dataset.songId;
        }

        const response = await fetchAuth(`/api/playlists/${playlistId}`);
        const playlist = await response.json();

        if (response.ok) {
            // Dont add duplicate songs
            if (playlist.song_ids.includes(songId)) {
                playlistMenu.classList.add('menu-hidden');
                return;
            }
            playlist.song_ids.push(songId);
            playlist.songs = playlist.song_ids;
            playlist.song_ids = undefined;

            const updateResponse = await fetchAuth(`/api/playlists/${playlistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(playlist)
            });

            if (updateResponse.ok) {
                playlistMenu.classList.add('menu-hidden');
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
        recentPlaylists.classList.remove('hidden');

        homeButton.classList.add('selected');
        searchButton.classList.remove('selected');
        uploadButton.classList.remove('selected');

        sidebar.classList.remove('active');

        window.scrollTo({ top: 0, behavior: 'smooth' });

        loadMusicList();
    });

    uploadButton.addEventListener('click', () => {
        const currentScreenElement = document.getElementById(currentScreen)
        if (currentScreenElement) {
            currentScreenElement.classList.remove('selected');
        }

        currentScreen = 'upload';
        musicSection.classList.add('hidden');
        recentPlaylists.classList.add('hidden');
        searchSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');

        uploadButton.classList.add('selected');
        searchButton.classList.remove('selected');
        homeButton.classList.remove('selected');

        sidebar.classList.remove('active');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    searchButton.addEventListener('click', () => {
        const currentScreenElement = document.getElementById(currentScreen)
        if (currentScreenElement) {
            currentScreenElement.classList.remove('selected');
        }

        currentScreen = 'search';
        musicSection.classList.add('hidden');
        recentPlaylists.classList.add('hidden');
        uploadSection.classList.add('hidden');
        searchSection.classList.remove('hidden');

        searchButton.classList.add('selected');
        uploadButton.classList.remove('selected');
        homeButton.classList.remove('selected');

        window.scrollTo({ top: 0, behavior: 'smooth' });

        sidebar.classList.remove('active');
    });

    function loadMusic (musics, element = musicList, skip = 0) {
        if (musics == null) {
            element.innerHTML = 'No music found';
            return;
        }
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

            if (checkColorTooDark(music.color)) music.color = Lighten(music.color);

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
                showPlaylistMenu(music);
            });

            element.appendChild(div);
        });
    }

    async function shareSong (songId) {
        try {

            const response = await fetchAuth(`/api/share/${songId}`, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error('Failed to generate share link');
            }

            const data = await response.json();
            const shareLink = `https://music.micr0.dev/share.html?token=${data.token}`;

            console.log('Share link:', shareLink);
            navigator.clipboard.writeText(shareLink);
            alert('Share link copied to clipboard');
        } catch (error) {
            console.error('Error sharing song:', error);
            alert('Error sharing song');
        }
    }

    async function loadMusicList () {
        const response = await fetchAuth('/api/music?limit=20');
        const musics = await response.json();

        if (musics == null) {
            musicList.innerHTML = 'No music found';
            return;
        }

        musicListTitle.textContent = 'Recently Added';

        loadMusic(musics);

        const response2 = await fetchAuth('/api/playlists?limit=6');
        const playlists = await response2.json();

        if (playlists == null) {
            wholePlaylistsList.innerHTML = 'No playlists found';
            return;
        }

        wholePlaylistsListTitle.textContent = 'Recently Created Playlists';

        loadPlaylists(playlists);
    }

    searchInput.addEventListener('input', async () => {
        const query = searchInput.value;
        if (query.length < 2) return;

        const response = await fetchAuth(`/api/search?q=${query}&limit=10`);
        const results = await response.json();

        console.log(results);

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
        searchResults.appendChild(musicTitle);
        searchResults.appendChild(musicDiv);
        searchResults.appendChild(albumsTitle);
        searchResults.appendChild(albumsDiv);

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

    function updateScrollingBanner (text) {
        dataScroll.innerHTML = `<span>${text} • &zwnj;</span><span id="num2">${text} • &zwnj;</span><span id="num3">${text} • &zwnj;</span><span id="num4">${text} • &zwnj;</span>`;
    }

    async function fetchStreamToken (musicId) {
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

    async function playTrack (music, isUserAction = true, play = true) {
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

        if (checkColorTooDark(music.color)) music.color = Lighten(music.color);

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

        // Add edit and share buttons to the cover art container
        const editButton = document.createElement('button');
        editButton.className = 'edit-song-button';
        editButton.innerHTML = `<svg><use href="#edit"></use></svg>`;
        editButton.addEventListener('click', () => {
            window.location.href = `/edit.html?id=${music.id}`;
        });

        const shareButton = document.createElement('button');
        shareButton.className = 'share-song-button';
        shareButton.innerHTML = `<svg><use href="#share"></use></svg>`;
        shareButton.addEventListener('click', (event) => {
            event.stopPropagation();
            shareSong(music.id);
        });

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-song-button';
        deleteButton.innerHTML = `<svg><use href="#delete"></use></svg>`;
        deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            const response = await fetchAuth(`/api/music/${music.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('Song Successfully Deleted');
                loadPlaylist(currentScreen);
                nextButton.click();
            } else {
                alert('Failed to delete song');
                console.error('Failed to delete song');
                console.error(response);
            }
        });

        // coverArt.parentElement.appendChild(editButton);
        coverArt.parentElement.appendChild(shareButton);
        coverArt.parentElement.appendChild(deleteButton);

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

    function loadQueue () {
        queue = openQueue.slice();
        shuffleQueue();
    }

    function shuffleQueue () {
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


    function getCurrentIndex () {
        let currentIndex;
        if (isShuffle) {
            currentIndex = shuffleedQueue.findIndex(m => m.id === currentTrack.id);
        } else {
            currentIndex = queue.findIndex(m => m.id === currentTrack.id);
        }
        return currentIndex;
    }

    function playNextTrack () {
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

    function playPreviousTrack () {
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


    function formatTime (seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;
        return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
    }

    function loadPlaylists (playlists, element = wholePlaylistsList) {
        element.innerHTML = '';
        playlists.forEach(async playlist => {
            let songs = [];
            playlist.songs.forEach((song, index) => {
                if (!song == "") {
                    songs.push(song);
                }
            });

            songs.reverse();

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
                <div class="playlist-item-count">${songs.length} songs</div>
            </div>
            `;

            div.appendChild(playlistInfo);

            div.addEventListener('click', () => {
                loadPlaylist(playlist.id);
            });

            if (document.getElementById(playlist.id)) {
                const addButton = document.createElement('button');
                addButton.className = 'added-playlist-button';
                addButton.innerHTML = `<svg><use href="#checkmark"></use></svg>`;
                div.appendChild(addButton);
            } else {
                const addButton = document.createElement('button');
                addButton.className = 'add-playlist-button';
                addButton.innerHTML = `<svg><use href="#plus"></use></svg>`;
                addButton.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const response = await fetchAuth(`/api/user/library/${playlist.id}`, {
                        method: 'POST'
                    });

                    if (response.ok) {
                        loadSidePlaylists();

                        const addButton = div.getElementsByClassName('add-playlist-button')[0];
                        const newButton = addButton.cloneNode(true);
                        addButton.parentNode.replaceChild(newButton, addButton);
                        newButton.className = 'added-playlist-button';
                        newButton.innerHTML = `<svg><use href="#checkmark"></use></svg>`;

                        div.appendChild(newButton);
                    } else {
                        alert('Failed to add playlist to user playlists');
                    }
                });
                div.appendChild(addButton);
            }

            // FIXME: Dont allow user who didnt create the playlist add songs to it

            const songIDs = songs.slice(0, 4);
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
                    div.style.setProperty('--art-color', song.color);

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

    async function loadSidePlaylists () {
        const response = await fetchAuth('/api/user/library');
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
            button.addEventListener('dblclick', (event) => {
                event.stopPropagation();
                loadPlaylist(playlist.id, false, true);
                sidebar.classList.remove('active');
            });

            playlistsList.appendChild(button);

            const option = document.createElement('option');
            option.value = playlist.id;
            option.textContent = playlist.name;
            playlistSelect.appendChild(option);

        });
    }

    async function loadPlaylist (playlistId, isAlbum = false, playOnLoad = false) {
        const currentScreenElement = document.getElementById(currentScreen)
        if (currentScreenElement) {
            currentScreenElement.classList.remove('selected');
        }

        currentScreen = playlistId;
        uploadSection.classList.add('hidden');
        searchSection.classList.add('hidden');
        recentPlaylists.classList.add('hidden');
        musicSection.classList.remove('hidden');

        homeButton.classList.remove('selected');
        searchButton.classList.remove('selected');
        uploadButton.classList.remove('selected');

        window.scrollTo({ top: 0, behavior: 'smooth' });

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

        if (playOnLoad) {
            playTrack(songs[0]);
        }

        if (!isAlbum) {
            response = await fetchAuth(`/api/playlists/${playlistId}?offset=40`);
            const playlist = await response.json();

            if (playlist == null) {
                return;
            }

            if (playlist.songs == null) {
                return;
            }

            loadMusic(playlist.songs, musicList, 40);
            loadQueue();
        }
    }

    // loadAlbums like loadPlaylists cards
    function loadAlbums (albums, element = albumsList) {
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
    fetchPlaylists();
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
    const alreadyDonatedBtn = document.getElementById("alredy-donated-button");

    const donated = localStorage.getItem("donated");
    if (donated) {
        modal.style.display = "none";
        return;
    }

    closeModalBtn.addEventListener("click", function () {
        modal.style.display = "none";
    });

    alreadyDonatedBtn.addEventListener("click", function () {
        modal.style.display = "none";
        localStorage.setItem("donated", "true");
    });

    if (window.innerWidth > 1000) {
        setTimeout(function () {
            modal.style.display = "block";
        }, 1000 * 60 * 20); // 20 minutes
    }
});
