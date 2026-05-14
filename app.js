const API_URL = 'https://document-qa-api-1.onrender.com';

let currentDocumentId = null;
let backendReady = false;
let backendCheckPromise = null;

const uploadForm = document.getElementById('upload-form');
const uploadStatus = document.getElementById('upload-status');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');

const qaSection = document.getElementById('qa-section');
const qaForm = document.getElementById('qa-form');
const questionInput = document.getElementById('question-input');
const askBtn = document.getElementById('ask-btn');
const documentInfo = document.getElementById('document-info');

const answerSection = document.getElementById('answer-section');
const answerContent = document.getElementById('answer-content');
const sourcesContent = document.getElementById('sources-content');
const sampleFile = document.getElementById('sample-file');
const backendStatusEl = document.getElementById('backend-status');
const statusText = backendStatusEl.querySelector('.status-text');

let samplePdfBlob = null;

// Health check functionality
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_URL}/health`, { method: 'GET' });
        if (response.ok) {
            backendReady = true;
            backendStatusEl.classList.remove('error');
            backendStatusEl.classList.add('ready');
            statusText.textContent = 'Backend ready';
            return true;
        }
    } catch (error) {
        // Backend not ready yet
    }
    return false;
}

async function waitForBackend() {
    if (backendReady) return true;

    // If already checking, wait for that check
    if (backendCheckPromise) {
        return backendCheckPromise;
    }

    statusText.textContent = 'Waking up server...';

    backendCheckPromise = new Promise(async (resolve) => {
        const maxAttempts = 30; // ~60 seconds max
        for (let i = 0; i < maxAttempts; i++) {
            if (await checkBackendHealth()) {
                resolve(true);
                backendCheckPromise = null;
                return;
            }
            await new Promise(r => setTimeout(r, 2000));
        }
        backendStatusEl.classList.add('error');
        statusText.textContent = 'Backend unavailable';
        resolve(false);
        backendCheckPromise = null;
    });

    return backendCheckPromise;
}

// Start health check on page load
checkBackendHealth();

// Pre-fetch the sample PDF
fetch('Led_Zeppelin.pdf')
    .then(response => response.blob())
    .then(blob => { samplePdfBlob = blob; });

async function loadSamplePdf() {
    if (!samplePdfBlob) {
        uploadStatus.textContent = 'Sample PDF not loaded yet, please wait...';
        uploadStatus.className = 'status loading';
        return;
    }

    const file = new File([samplePdfBlob], 'Led_Zeppelin.pdf', { type: 'application/pdf' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    uploadStatus.textContent = 'Sample loaded! Click Upload to continue.';
    uploadStatus.className = 'status success';
}

// Click to load sample
sampleFile.addEventListener('click', loadSamplePdf);

// Drag and drop support
let isDraggingSample = false;

sampleFile.addEventListener('dragstart', (e) => {
    isDraggingSample = true;
    e.dataTransfer.setData('text/plain', 'sample-pdf');
    e.dataTransfer.effectAllowed = 'copy';
});

sampleFile.addEventListener('dragend', () => {
    isDraggingSample = false;
});

uploadForm.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (isDraggingSample) {
        uploadForm.classList.add('drag-over');
    }
});

uploadForm.addEventListener('dragleave', (e) => {
    if (!uploadForm.contains(e.relatedTarget)) {
        uploadForm.classList.remove('drag-over');
    }
});

uploadForm.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadForm.classList.remove('drag-over');

    if (isDraggingSample) {
        loadSamplePdf();
    }
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    if (!file) return;

    uploadBtn.disabled = true;

    // Wait for backend if not ready
    if (!backendReady) {
        uploadStatus.textContent = 'Waking up server, please wait...';
        uploadStatus.className = 'status loading';
        const ready = await waitForBackend();
        if (!ready) {
            uploadStatus.textContent = 'Server unavailable. Please try again later.';
            uploadStatus.className = 'status error';
            uploadBtn.disabled = false;
            return;
        }
    }

    const formData = new FormData();
    formData.append('file', file);

    uploadStatus.textContent = 'Uploading and processing...';
    uploadStatus.className = 'status loading';

    try {
        const response = await fetch(`${API_URL}/api/v1/documents/`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Upload failed');
        }

        const data = await response.json();
        currentDocumentId = data.id;

        uploadStatus.textContent = `Uploaded: ${data.filename}`;
        uploadStatus.className = 'status success';

        documentInfo.textContent = `Document: ${data.filename}`;
        qaSection.style.display = 'block';
        questionInput.focus();

    } catch (error) {
        uploadStatus.textContent = `Error: ${error.message}`;
        uploadStatus.className = 'status error';
    } finally {
        uploadBtn.disabled = false;
    }
});

qaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const question = questionInput.value.trim();
    if (!question || !currentDocumentId) return;

    askBtn.disabled = true;
    answerSection.style.display = 'block';
    sourcesContent.innerHTML = '';

    // Wait for backend if not ready
    if (!backendReady) {
        answerContent.textContent = 'Waking up server, please wait...';
        const ready = await waitForBackend();
        if (!ready) {
            answerContent.textContent = 'Server unavailable. Please try again later.';
            askBtn.disabled = false;
            return;
        }
    }

    answerContent.textContent = 'Thinking...';

    try {
        const response = await fetch(`${API_URL}/api/v1/ask/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                document_id: currentDocumentId,
                question: question,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Question failed');
        }

        const data = await response.json();

        answerContent.textContent = data.answer;

        if (data.sources && data.sources.length > 0) {
            sourcesContent.innerHTML = data.sources
                .map(s => `<p>${s}</p>`)
                .join('');
        } else {
            sourcesContent.innerHTML = '<p>No sources available</p>';
        }

    } catch (error) {
        answerContent.textContent = `Error: ${error.message}`;
    } finally {
        askBtn.disabled = false;
    }
});
