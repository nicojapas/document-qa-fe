const API_URL = 'https://document-qa-api-1.onrender.com/';

let currentDocumentId = null;

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
let samplePdfBlob = null;

// Pre-fetch the sample PDF
fetch('sample.pdf')
    .then(response => response.blob())
    .then(blob => { samplePdfBlob = blob; });

async function loadSamplePdf() {
    if (!samplePdfBlob) {
        uploadStatus.textContent = 'Sample PDF not loaded yet, please wait...';
        uploadStatus.className = 'status loading';
        return;
    }

    const file = new File([samplePdfBlob], 'sample.pdf', { type: 'application/pdf' });
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

    const formData = new FormData();
    formData.append('file', file);

    uploadBtn.disabled = true;
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
    answerContent.textContent = 'Thinking...';
    answerSection.style.display = 'block';
    sourcesContent.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/api/v1/qa/`, {
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
