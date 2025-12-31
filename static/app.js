const fetchBtn = document.getElementById('fetchBtn');
const downloadBtn = document.getElementById('downloadBtn');
const videoUrlInput = document.getElementById('videoUrl');
const resultSection = document.getElementById('resultSection');
const progressSection = document.getElementById('progressSection');
const loader = document.querySelector('.loader');
const btnText = document.querySelector('.btn-text');

// Elements for Video Card
const thumbnailInfo = document.getElementById('thumbnail');
const videoTitleInfo = document.getElementById('videoTitle');
const formatSelect = document.getElementById('formatSelect');

// Elements for Progress
const statusText = document.getElementById('statusText');
const percentText = document.getElementById('percentText');
const progressBar = document.getElementById('progressBar');
const speedText = document.getElementById('speedText');
const etaText = document.getElementById('etaText');

// Generate a random Client ID
const clientId = 'client-' + Math.random().toString(36).substr(2, 9);
console.log('Client ID:', clientId);

// Connect WebSocket
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = `${protocol}://${window.location.host}/ws/${clientId}`;
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
    console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleProgressUpdate(data);
};

ws.onclose = () => {
    console.log('WebSocket disconnected');
    statusText.innerText = "Connection lost. Please refresh.";
};

// Event Listeners
fetchBtn.addEventListener('click', async () => {
    const url = videoUrlInput.value.trim();
    if (!url) return;

    // UI Loading State
    setLoading(true);
    resultSection.classList.add('hidden');
    progressSection.classList.add('hidden');

    try {
        const response = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) throw new Error('Failed to fetch info');

        const data = await response.json();
        showVideoData(data);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        setLoading(false);
    }
});

downloadBtn.addEventListener('click', async () => {
    const url = videoUrlInput.value.trim();
    const formatId = formatSelect.value;

    if (!url || !formatId) return;

    progressSection.classList.remove('hidden');
    downloadBtn.disabled = true;
    downloadBtn.innerText = "Starting...";

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                format_id: formatId,
                client_id: clientId
            })
        });

        if (!response.ok) throw new Error('Download failed to start');

    } catch (error) {
        alert('Error: ' + error.message);
        downloadBtn.disabled = false;
        downloadBtn.innerText = "Download";
    }
});

function setLoading(isLoading) {
    fetchBtn.disabled = isLoading;
    if (isLoading) {
        loader.classList.remove('hidden');
        btnText.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
        btnText.classList.remove('hidden');
    }
}

function showVideoData(data) {
    thumbnailInfo.src = data.thumbnail;
    videoTitleInfo.textContent = data.title;

    formatSelect.innerHTML = '';
    data.formats.forEach(format => {
        const option = document.createElement('option');
        option.value = format.format_id;
        option.textContent = `${format.resolution} - ${format.ext} ${format.filesize ? '(' + (format.filesize / 1024 / 1024).toFixed(1) + 'MB)' : ''}`;
        formatSelect.appendChild(option);
    });

    resultSection.classList.remove('hidden');
}

function handleProgressUpdate(data) {
    if (data.status === 'downloading') {
        statusText.innerText = "Downloading...";
        percentText.innerText = `${data.percent.toFixed(1)}%`;
        progressBar.style.width = `${data.percent}%`;
        speedText.innerText = data.speed;
        etaText.innerText = `ETA: ${data.eta}`;
        downloadBtn.innerText = "Downloading...";
    } else if (data.status === 'finished') {
        statusText.innerText = "Completed!";
        percentText.innerText = "100%";
        progressBar.style.width = "100%";
        downloadBtn.innerText = "Downloaded";
        downloadBtn.disabled = false;
        alert(`Download Completed: ${data.filename}`);
    } else if (data.status === 'error') {
        statusText.innerText = "Error Occurred";
        alert('Download Error: ' + data.error);
        downloadBtn.disabled = false;
        downloadBtn.innerText = "Download";
    }
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js')
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.log('SW Failed', err));
    });
}
