const dataScroll = document.getElementById('data-scroll');
const trackInfo = document.getElementById('track-info');
const nowPlayingContainer = document.getElementById('now-playing-container');
const coverArt = document.getElementById('cover-art');
const miniCoverArt = document.getElementById('mini-cover-art');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const seekSlider = document.getElementById('seek-slider');
const volumeSlider = document.getElementById('volume-slider');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const audioPlayer = document.getElementById('audio-player');
const musicList = document.getElementById('music-list');
const musicListTitle = document.getElementById('music-list-title');
const currentTimeLabel = document.getElementById('current-time');
const durationLabel = document.getElementById('duration');
const playPauseButton = document.getElementById('play-pause');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const shuffleButton = document.getElementById('shuffle-button');
const repeatButton = document.getElementById('repeat-button');

let currentTrack = null;

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

function checkColorTooDark(color) {
    const c = color.substring(1);      // strip #
    const rgb = parseInt(c, 16);   // convert rrggbb to decimal
    const r = (rgb >> 16) & 0xff;  // extract red
    const g = (rgb >> 8) & 0xff;  // extract green
    const b = (rgb >> 0) & 0xff;  // extract blue

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709

    return luma < 16;
}

function Lighten(color) {
    let num = parseInt(color, 16),
        amt = 45,
        R = (num >> 16) + amt,
        B = ((num >> 8) & 0x00FF) + amt,
        G = (num & 0x0000FF) + amt;

    let newColor = G | (B << 8) | (R << 16);
    return "#" + newColor.toString(16);
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

String.prototype.toTitleCase = function () {
    return this.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

function displaySharedSong(music, token) {

    musicListTitle.textContent = 'Shared Song';
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
            `;

    if (isPlaying) {
        div.classList.add('playing');
    }

    div.id = music.id;

    div.addEventListener('click', () => {
        playTrack(music, token);
    });

    musicList.appendChild(div);
}

async function playTrack(music, token) {
    audioPlayer.src = `/api/stream?token=${token}`;

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

    audioPlayer.play();
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'inline';
    isPlaying = true;

    if (currentTrack) {
        const previousTrack = document.getElementById(currentTrack.id);
        if (previousTrack) {
            previousTrack.classList.remove('playing');
        }
    }

    currentTrack = music;

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
}

function updateScrollingBanner(text) {
    dataScroll.innerHTML = `<span>${text} • &zwnj;</span><span id="num2">${text} • &zwnj;</span><span id="num3">${text} • &zwnj;</span><span id="num4">${text} • &zwnj;</span>`;
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

function playPreviousTrack() {
    playTrack(currentTrack);
}

function playNextTrack() {
    playTrack(currentTrack);
}