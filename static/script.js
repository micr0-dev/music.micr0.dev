document.addEventListener('DOMContentLoaded', function () {
    const uploadForm = document.getElementById('upload-form');
    const uploadProgress = document.getElementById('upload-progress');
    const musicList = document.getElementById('music-list');
    const audioPlayer = document.getElementById('audio-player');
    const playPauseButton = document.getElementById('play-pause');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const trackTitle = document.getElementById('track-title');
    const trackArtist = document.getElementById('track-artist');
    const nowPlayingContainer = document.getElementById('now-playing-container');
    const seekSlider = document.getElementById('seek-slider');
    const volumeSlider = document.getElementById('volume-slider');
    const currentTimeDisplay = document.getElementById('current-time');
    const durationDisplay = document.getElementById('duration');
    const playlistList = document.getElementById('playlist-list');
    const newPlaylistButton = document.getElementById('new-playlist-button');
    const playlistModal = document.getElementById('playlist-modal');
    const closeModalButton = document.querySelector('.close-button');
    const createPlaylistButton = document.getElementById('create-playlist-button');
    const playlistNameInput = document.getElementById('playlist-name-input');

    const playlists = [];
    let currentTrack = null;
    let isPlaying = false;
    let intervalId;

    uploadForm.addEventListener('submit', function (e) {
        e.preventDefault();
        uploadProgress.classList.remove('hidden');
        const formData = new FormData(uploadForm);

        fetch('upload.php', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                uploadProgress.classList.add('hidden');
                if (data.success) {
                    data.files.forEach(file => {
                        const div = document.createElement('div');
                        div.className = 'music-item';
                        div.dataset.path = file.path;
                        div.dataset.title = file.title;
                        div.dataset.artist = file.artist;
                        div.dataset.album = file.album;
                        div.dataset.cover = file.cover;
                        div.dataset.duration = file.duration;
                        div.innerHTML = `
                            <h3>${file.title}</h3>
                            <p>${file.artist}</p>
                        `;
                        div.style.setProperty('--art-color', getAverageColorFromImage(file.cover));

                        div.addEventListener('click', () => {
                            playTrack(file);
                        });
                        musicList.appendChild(div);
                    });
                } else {
                    alert('Error uploading files.');
                }
            })
            .catch(error => {
                uploadProgress.classList.add('hidden');
                console.error('Error uploading files:', error);
            });
    });

    playPauseButton.addEventListener('click', function () {
        if (isPlaying) {
            audioPlayer.pause();
        } else if (currentTrack) {
            audioPlayer.play();
        }
    });

    audioPlayer.addEventListener('play', function () {
        isPlaying = true;
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        nowPlayingContainer.classList.remove('not-playing');
        intervalId = setInterval(updateSeekBar, 500);
    });

    audioPlayer.addEventListener('pause', function () {
        isPlaying = false;
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        clearInterval(intervalId);
    });

    audioPlayer.addEventListener('ended', function () {
        isPlaying = false;
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        clearInterval(intervalId);
        seekSlider.value = 0;
        currentTimeDisplay.textContent = formatTime(0);
    });

    audioPlayer.addEventListener('loadedmetadata', function () {
        seekSlider.max = audioPlayer.duration * 1000;
        durationDisplay.textContent = formatTime(audioPlayer.duration);
    });

    seekSlider.addEventListener('input', function () {
        audioPlayer.currentTime = seekSlider.value / 1000;
    });

    volumeSlider.addEventListener('input', function () {
        audioPlayer.volume = volumeSlider.value / 100;
    });

    newPlaylistButton.addEventListener('click', function () {
        playlistModal.classList.remove('hidden');
    });

    closeModalButton.addEventListener('click', function () {
        playlistModal.classList.add('hidden');
    });

    createPlaylistButton.addEventListener('click', function () {
        const playlistName = playlistNameInput.value.trim();
        if (playlistName) {
            const playlist = {
                name: playlistName,
                tracks: []
            };
            playlists.push(playlist);
            updatePlaylistList();
            playlistModal.classList.add('hidden');
            playlistNameInput.value = '';
        } else {
            alert('Please enter a playlist name.');
        }
    });

    function updatePlaylistList() {
        playlistList.innerHTML = '';
        playlists.forEach((playlist, index) => {
            const li = document.createElement('li');
            li.textContent = playlist.name;
            li.addEventListener('click', () => {
                loadPlaylist(index);
            });
            playlistList.appendChild(li);
        });
    }

    function loadPlaylist(index) {
        const playlist = playlists[index];
        musicList.innerHTML = '';
        playlist.tracks.forEach(track => {
            const div = document.createElement('div');
            div.className = 'music-item';
            div.dataset.path = track.path;
            div.dataset.title = track.title;
            div.dataset.artist = track.artist;
            div.dataset.album = track.album;
            div.dataset.cover = track.cover;
            div.dataset.duration = track.duration;
            div.innerHTML = `
                <h3>${track.title}</h3>
                <p>${track.artist}</p>
            `;
            div.style.setProperty('--art-color', getAverageColorFromImage(track.cover));

            div.addEventListener('click', () => {
                playTrack(track);
            });
            musicList.appendChild(div);
        });
    }

    function playTrack(track) {
        currentTrack = track;
        audioPlayer.src = track.path;
        trackTitle.textContent = track.title;
        trackArtist.textContent = track.artist;
        document.getElementById('cover-art').src = track.cover;
        audioPlayer.play();
    }

    function updateSeekBar() {
        seekSlider.value = audioPlayer.currentTime * 1000;
        currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime);
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function getAverageColorFromImage(url) {
        const img = new Image();
        img.src = url;
        img.crossOrigin = 'Anonymous';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < data.length; i += 4) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
            }
            r = Math.floor(r / (data.length / 4));
            g = Math.floor(g / (data.length / 4));
            b = Math.floor(b / (data.length / 4));
            return `rgb(${r},${g},${b})`;
        };
        return 'rgb(128,128,128)';
    }
});
