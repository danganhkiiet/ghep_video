// Application State
let steps = [];
let activeJobId = null;
let pollInterval = null;
let activeImageStepId = null;
let backgroundMusic = {
    path: null,
    name: null,
    volume: 0.15
};

// DOM Elements
const stepsContainer = document.getElementById('steps-container');
const btnAddStep = document.getElementById('btn-add-step');
const btnGenerateVideo = document.getElementById('btn-generate-video');
const stepCountBadge = document.getElementById('step-count-badge');
const totalDurationBadge = document.createElement('span');
const btnSaveProject = document.getElementById('btn-save-project');
const btnLoadProject = document.getElementById('btn-load-project');
const projectFileInput = document.getElementById('project-file-input');

// Background Music DOM Elements
const bgmDropzone = document.getElementById('bgm-dropzone');
const fileInputBgm = document.getElementById('file-input-bgm');
const bgmUploadState = document.getElementById('bgm-upload-state');
const bgmPreviewState = document.getElementById('bgm-preview-state');
const bgmFilename = document.getElementById('bgm-filename');
const bgmPlayer = document.getElementById('bgm-player');
const btnRemoveBgm = document.getElementById('btn-remove-bgm');
const bgmVolumeContainer = document.getElementById('bgm-volume-container');
const bgmVolumeSlider = document.getElementById('bgm-volume-slider');
const bgmVolumeValue = document.getElementById('bgm-volume-value');

// Modal Elements
const exportModal = document.getElementById('export-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalProcessingState = document.getElementById('modal-processing-state');
const modalSuccessState = document.getElementById('modal-success-state');
const modalFailedState = document.getElementById('modal-failed-state');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const progressStepInfo = document.getElementById('progress-step-info');
const processingStatusText = document.getElementById('processing-status-text');
const finalVideoPlayer = document.getElementById('final-video-player');
const btnDownloadVideo = document.getElementById('btn-download-video');
const btnCloseSuccess = document.getElementById('btn-close-success');
const btnCloseFailed = document.getElementById('btn-close-failed');
const errorLogMessage = document.getElementById('error-log-message');

// Toast Notification
const toast = document.getElementById('toast');

// --- Helper Functions ---

// Show Toast Message
function showToast(message, duration = 3000) {
    const toastText = toast.querySelector('.toast-message');
    toastText.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Generate unique ID for local steps
function generateUniqueId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

// Save Project State to LocalStorage
function autoSaveToLocalStorage() {
    const resolution = document.querySelector('input[name="resolution"]:checked').value;
    const imageFit = document.querySelector('input[name="imageFit"]:checked').value;
    
    const projectState = {
        steps,
        resolution,
        imageFit,
        backgroundMusic
    };
    localStorage.setItem('videomaker_project_state', JSON.stringify(projectState));
}

// Load Project State from LocalStorage
function loadFromLocalStorage() {
    const saved = localStorage.getItem('videomaker_project_state');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            steps = state.steps || [];
            
            // Set resolution radio
            if (state.resolution) {
                const radio = document.querySelector(`input[name="resolution"][value="${state.resolution}"]`);
                if (radio) radio.checked = true;
            }
            // Set image fit radio
            if (state.imageFit) {
                const radio = document.querySelector(`input[name="imageFit"][value="${state.imageFit}"]`);
                if (radio) radio.checked = true;
            }

            // Load background music
            if (state.backgroundMusic) {
                backgroundMusic = state.backgroundMusic;
            } else {
                backgroundMusic = { path: null, name: null, volume: 0.15 };
            }
            updateBgmUI();
        } catch (e) {
            console.error('Failed to parse saved state', e);
        }
    }
}

// Format seconds into MM:SS
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatTotalDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';

    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function getTotalDuration() {
    return steps.reduce((total, step) => {
        const duration = parseFloat(step.duration);
        return total + (Number.isFinite(duration) && duration > 0 ? duration : 0);
    }, 0);
}

function updateTimelineStats() {
    totalDurationBadge.textContent = `Tổng: ${formatTotalDuration(getTotalDuration())}`;
}

function getTransitionOptions(selectedTransition) {
    const options = [
        { value: 'none', label: 'Cắt trực tiếp' },
        { value: 'fade', label: 'Mờ dần qua Đen' },
        { value: 'fade_white', label: 'Mờ dần qua Trắng' },
        { value: 'flash_white', label: 'Flash sáng nhanh' },
        { value: 'zoom_in', label: 'Zoom vào nhẹ' },
        { value: 'zoom_out', label: 'Zoom ra nhẹ' },
        { value: 'pan_left', label: 'Lướt sang trái' },
        { value: 'pan_right', label: 'Lướt sang phải' },
        { value: 'pan_up', label: 'Lướt lên' },
        { value: 'pan_down', label: 'Lướt xuống' }
    ];

    return options.map(option => (
        `<option value="${option.value}" ${selectedTransition === option.value ? 'selected' : ''}>${option.label}</option>`
    )).join('');
}

// --- Dynamic UI Rendering ---

// Render the entire steps list
function renderSteps() {
    updateTimelineStats();
    stepsContainer.innerHTML = '';
    stepCountBadge.textContent = `${steps.length} bước`;

    if (steps.length === 0) {
        stepsContainer.innerHTML = `
            <div class="glass-card" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <i class="fa-regular fa-folder-open" style="font-size: 40px; margin-bottom: 12px; opacity: 0.5;"></i>
                <p>Chưa có bước nào. Hãy thêm bước mới để bắt đầu!</p>
            </div>
        `;
        return;
    }

    steps.forEach((step, index) => {
        // Ensure transition property exists
        if (!step.transition) step.transition = 'none';

        const stepCard = document.createElement('div');
        stepCard.className = 'step-card';
        stepCard.dataset.id = step.id;

        // Determine if up/down arrows should be disabled
        const isFirst = index === 0;
        const isLast = index === steps.length - 1;

        stepCard.innerHTML = `
            <!-- Left Order Column -->
            <div class="step-order-bar">
                <span class="step-number">${index + 1}</span>
                <button class="btn-arrow btn-move-up" ${isFirst ? 'disabled' : ''} title="Di chuyển lên">
                    <i class="fa-solid fa-chevron-up"></i>
                </button>
                <button class="btn-arrow btn-move-down" ${isLast ? 'disabled' : ''} title="Di chuyển xuống">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>

            <!-- Main Card Fields -->
            <div class="step-fields">
                <!-- Image Field -->
                <div class="upload-field">
                    <div class="field-label">
                        <i class="fa-regular fa-image"></i> Hình ảnh
                    </div>
                    <div class="dropzone image-dropzone" id="img-drop-${step.id}" tabindex="0" title="Click, kéo thả hoặc Ctrl+V để thêm ảnh">
                        ${step.imagePath ? `
                            <div class="preview-container">
                                <img src="/${step.imagePath}" class="img-preview" alt="Preview Image">
                                <button class="btn-remove-file btn-remove-image" title="Xóa hình ảnh">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        ` : `
                            <i class="fa-solid fa-cloud-arrow-up dropzone-icon"></i>
                            <div class="dropzone-text">Kéo thả ảnh hoặc click để chọn</div>
                            <div class="dropzone-subtext">PNG, JPG, WebP</div>
                        `}
                        <input type="file" class="file-input-image" accept="image/*" style="display: none;">
                    </div>
                </div>

                <!-- Voice Field -->
                <div class="upload-field">
                    <div class="field-label">
                        <i class="fa-solid fa-microphone-lines"></i> Giọng nói (Voice / Audio)
                    </div>
                    <div class="dropzone audio-dropzone" id="aud-drop-${step.id}">
                        ${step.audioPath ? `
                            <div class="preview-container">
                                <div class="audio-preview-content">
                                    <i class="fa-solid fa-waveform audio-icon-glow"></i>
                                    <span class="audio-filename" title="${step.audioName}">${step.audioName}</span>
                                    <span class="audio-duration">${formatDuration(step.duration)}</span>
                                    <audio src="/${step.audioPath}" controls></audio>
                                </div>
                                <button class="btn-remove-file btn-remove-audio" title="Xóa file âm thanh">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        ` : `
                            <i class="fa-solid fa-music dropzone-icon"></i>
                            <div class="dropzone-text">Kéo thả voice hoặc click để chọn</div>
                            <div class="dropzone-subtext">MP3, WAV, M4A</div>
                        `}
                        <input type="file" class="file-input-audio" accept="audio/*" style="display: none;">
                    </div>
                </div>
            </div>

            <!-- Right Actions Column -->
            <div class="step-actions-bar">
                <button class="btn-delete-step" title="Xóa bước này">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        `;

        setupStepEvents(stepCard, step);
        stepsContainer.appendChild(stepCard);

        // Render transition row between steps
        if (index < steps.length - 1) {
            const transRow = document.createElement('div');
            transRow.className = 'transition-row';
            transRow.dataset.index = index;
            transRow.innerHTML = `
                <div class="transition-line"></div>
                <div class="transition-selector-capsule">
                    <span class="transition-label"><i class="fa-solid fa-arrows-left-right-to-line"></i> Hiệu ứng chuyển tiếp:</span>
                    <select class="transition-select" data-index="${index}">
                        <option value="none" ${step.transition === 'none' ? 'selected' : ''}>Cắt trực tiếp (Không hiệu ứng)</option>
                        <option value="fade" ${step.transition === 'fade' ? 'selected' : ''}>Mờ dần (Fade qua Đen)</option>
                        <option value="fade_white" ${step.transition === 'fade_white' ? 'selected' : ''}>Mờ dần (Fade qua Trắng)</option>
                    </select>
                </div>
                <div class="transition-line"></div>
            `;

            const selectEl = transRow.querySelector('.transition-select');
            selectEl.innerHTML = getTransitionOptions(step.transition);
            selectEl.addEventListener('change', (e) => {
                const stepIdx = parseInt(e.target.dataset.index, 10);
                steps[stepIdx].transition = e.target.value;
                autoSaveToLocalStorage();
                showToast('Đã lưu thay đổi hiệu ứng chuyển cảnh.');
            });

            stepsContainer.appendChild(transRow);
        }
    });
}

// Setup Event Listeners for a Step Card
function setupStepEvents(stepCard, step) {
    const id = step.id;
    const imgDrop = stepCard.querySelector('.image-dropzone');
    const audDrop = stepCard.querySelector('.audio-dropzone');
    const imgInput = stepCard.querySelector('.file-input-image');
    const audInput = stepCard.querySelector('.file-input-audio');

    // --- Image Upload Flow ---
    if (imgDrop && imgInput) {
        const setActiveImageDropzone = () => {
            activeImageStepId = id;
            document.querySelectorAll('.image-dropzone').forEach(zone => zone.classList.remove('paste-target'));
            imgDrop.classList.add('paste-target');
        };

        imgDrop.addEventListener('mouseenter', setActiveImageDropzone);
        imgDrop.addEventListener('focus', setActiveImageDropzone);

        imgDrop.addEventListener('click', (e) => {
            if (e.target.closest('.btn-remove-image')) return;
            setActiveImageDropzone();
            imgInput.click();
        });

        imgInput.addEventListener('change', () => {
            if (imgInput.files.length > 0) {
                uploadFile(imgInput.files[0], id, 'image');
            }
        });

        setupDragDrop(imgDrop, (file) => uploadFile(file, id, 'image'));
    }

    // --- Audio Upload Flow ---
    if (audDrop && audInput) {
        audDrop.addEventListener('click', (e) => {
            if (e.target.closest('.btn-remove-audio')) return;
            audInput.click();
        });

        audInput.addEventListener('change', () => {
            if (audInput.files.length > 0) {
                uploadFile(audInput.files[0], id, 'audio');
            }
        });

        setupDragDrop(audDrop, (file) => uploadFile(file, id, 'audio'));
    }

    // --- Delete File Actions ---
    const btnRemoveImg = stepCard.querySelector('.btn-remove-image');
    if (btnRemoveImg) {
        btnRemoveImg.addEventListener('click', (e) => {
            e.stopPropagation();
            const stepObj = steps.find(s => s.id === id);
            if (stepObj) {
                const pathToDelete = stepObj.imagePath;
                stepObj.imagePath = null;
                stepObj.imageName = null;
                renderSteps();
                autoSaveToLocalStorage();
                if (pathToDelete) deleteFilesFromServer([pathToDelete]);
            }
        });
    }

    const btnRemoveAud = stepCard.querySelector('.btn-remove-audio');
    if (btnRemoveAud) {
        btnRemoveAud.addEventListener('click', (e) => {
            e.stopPropagation();
            const stepObj = steps.find(s => s.id === id);
            if (stepObj) {
                const pathToDelete = stepObj.audioPath;
                stepObj.audioPath = null;
                stepObj.audioName = null;
                stepObj.duration = null;
                renderSteps();
                autoSaveToLocalStorage();
                if (pathToDelete) deleteFilesFromServer([pathToDelete]);
            }
        });
    }

    // --- Card Ordering & Deletion Actions ---
    stepCard.querySelector('.btn-move-up').addEventListener('click', () => {
        const index = steps.findIndex(s => s.id === id);
        if (index > 0) {
            const temp = steps[index];
            steps[index] = steps[index - 1];
            steps[index - 1] = temp;
            renderSteps();
            autoSaveToLocalStorage();
        }
    });

    stepCard.querySelector('.btn-move-down').addEventListener('click', () => {
        const index = steps.findIndex(s => s.id === id);
        if (index < steps.length - 1) {
            const temp = steps[index];
            steps[index] = steps[index + 1];
            steps[index + 1] = temp;
            renderSteps();
            autoSaveToLocalStorage();
        }
    });

    stepCard.querySelector('.btn-delete-step').addEventListener('click', () => {
        const stepToDelete = steps.find(s => s.id === id);
        if (stepToDelete) {
            const paths = [stepToDelete.imagePath, stepToDelete.audioPath];
            steps = steps.filter(s => s.id !== id);
            renderSteps();
            autoSaveToLocalStorage();
            deleteFilesFromServer(paths);
            showToast('Đã xóa bước và tệp nháp liên quan.');
        }
    });
}

// Setup Drag & Drop Handlers on Dropzone Elements
function setupDragDrop(element, callback) {
    ['dragenter', 'dragover'].forEach(eventName => {
        element.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        element.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('dragover');
        }, false);
    });

    element.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            callback(files[0]);
        }
    });
}

function findStepForPastedImage() {
    if (activeImageStepId && steps.some(step => step.id === activeImageStepId)) {
        return activeImageStepId;
    }

    const firstEmptyImageStep = steps.find(step => !step.imagePath);
    return (firstEmptyImageStep || steps[0])?.id || null;
}

async function handlePasteImage(event) {
    const items = event.clipboardData?.items || [];
    const imageItem = Array.from(items).find(item => item.type.startsWith('image/'));
    if (!imageItem) return;

    const stepId = findStepForPastedImage();
    if (!stepId) {
        showToast('Vui lòng thêm ít nhất một bước trước khi dán ảnh.');
        return;
    }

    const file = imageItem.getAsFile();
    if (!file) {
        showToast('Không đọc được ảnh từ clipboard.');
        return;
    }

    event.preventDefault();

    const extension = file.type.split('/')[1] || 'png';
    const pastedFile = new File([file], `clipboard-image-${Date.now()}.${extension}`, { type: file.type });
    activeImageStepId = stepId;
    await uploadFile(pastedFile, stepId, 'image');
}

// Upload File via Fetch API
async function uploadFile(file, stepId, type) {
    const formData = new FormData();
    formData.append('file', file);

    const stepObj = steps.find(s => s.id === stepId);
    if (!stepObj) return;

    // Show loading state visually inside the dropzone
    const dropzoneId = type === 'image' ? `img-drop-${stepId}` : `aud-drop-${stepId}`;
    const dropzone = document.getElementById(dropzoneId);
    if (dropzone) {
        dropzone.innerHTML = `
            <div class="preview-container" style="background: rgba(14,20,35,0.85)">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: var(--primary); margin-bottom: 8px;"></i>
                <div class="dropzone-text">Đang tải lên...</div>
            </div>
        `;
    }

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed on server');
        }

        const data = await response.json();

        if (data.success) {
            if (type === 'image') {
                stepObj.imagePath = data.path;
                stepObj.imageName = file.name;
            } else {
                stepObj.audioPath = data.path;
                stepObj.audioName = file.name;
                stepObj.duration = data.duration || 5.0; // Use parsed backend duration or fallback
            }

            renderSteps();
            autoSaveToLocalStorage();
            showToast(`Đã tải lên ${type === 'image' ? 'ảnh' : 'file voice'} thành công.`);
        } else {
            showToast('Lỗi: Tải tệp lên thất bại.');
            renderSteps();
        }
    } catch (error) {
        console.error('File upload error:', error);
        showToast('Lỗi: Không thể kết nối tới máy chủ.');
        renderSteps();
    }
}

// Update Background Music UI Elements
function updateBgmUI() {
    bgmUploadState.innerHTML = `
        <i class="fa-solid fa-cloud-arrow-up dropzone-icon"></i>
        <div class="dropzone-text">Tải lên nhạc nền</div>
        <div class="dropzone-subtext">MP3, WAV, M4A</div>
    `;

    if (backgroundMusic && backgroundMusic.path) {
        bgmUploadState.style.display = 'none';
        bgmPreviewState.style.display = 'flex';
        bgmFilename.textContent = backgroundMusic.name || 'bg_music.mp3';
        bgmPlayer.src = '/' + backgroundMusic.path;
        bgmVolumeContainer.style.display = 'block';
        
        const volVal = Math.round(backgroundMusic.volume * 100);
        bgmVolumeSlider.value = volVal;
        bgmVolumeValue.textContent = volVal + '%';
    } else {
        bgmUploadState.style.display = 'flex';
        bgmPreviewState.style.display = 'none';
        bgmVolumeContainer.style.display = 'none';
        bgmPlayer.pause();
        bgmPlayer.src = '';
    }
}

// Upload Background Music File
async function uploadBgmFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    bgmUploadState.innerHTML = `
        <div class="preview-container" style="background: rgba(14,20,35,0.85); position: static; height: auto;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 20px; color: var(--primary); margin-bottom: 6px;"></i>
            <div class="dropzone-text">Đang tải nhạc nền...</div>
        </div>
    `;

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed on server');
        }

        const data = await response.json();

        if (data.success) {
            backgroundMusic.path = data.path;
            backgroundMusic.name = file.name;
            updateBgmUI();
            autoSaveToLocalStorage();
            showToast('Đã tải lên nhạc nền thành công.');
        } else {
            showToast('Lỗi: Tải nhạc nền thất bại.');
            updateBgmUI();
        }
    } catch (error) {
        console.error('BGM upload error:', error);
        showToast('Lỗi: Không thể kết nối tới máy chủ.');
        updateBgmUI();
    }
}

// --- Video Generation & Polling Lifecycle ---

async function generateVideo() {
    // 1. Validation
    if (steps.length === 0) {
        showToast('Vui lòng thêm ít nhất một bước!');
        return;
    }

    const invalidSteps = steps.filter(s => !s.imagePath || !s.audioPath);
    if (invalidSteps.length > 0) {
        showToast('Tất cả các bước phải có đủ hình ảnh và voice file!');
        return;
    }

    const resolution = document.querySelector('input[name="resolution"]:checked').value;
    const imageFit = document.querySelector('input[name="imageFit"]:checked').value;

    // 2. Open modal and show processing view
    exportModal.classList.add('open');
    modalProcessingState.style.display = 'block';
    modalSuccessState.style.display = 'none';
    modalFailedState.style.display = 'none';
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressStepInfo.textContent = 'Đang gửi yêu cầu...';
    processingStatusText.textContent = 'Đang khởi chạy luồng xử lý video...';

    // Disable closing modal while processing to prevent losing state
    btnCloseModal.style.display = 'none';

    try {
        // 3. Post to backend
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps, resolution, imageFit, backgroundMusic })
        });

        if (!response.ok) {
            throw new Error('Failed to start video generation');
        }

        const data = await response.json();
        if (data.success && data.jobId) {
            activeJobId = data.jobId;
            startPollingStatus(data.jobId);
        } else {
            throw new Error(data.error || 'Server rejected video generation request');
        }
    } catch (e) {
        console.error(e);
        showFailedState(e.message);
    }
}

function startPollingStatus(jobId) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/status/${jobId}`);
            if (!response.ok) {
                throw new Error('Failed to check rendering progress');
            }

            const statusData = await response.json();

            if (statusData.status === 'processing') {
                updateProgress(statusData.progress, `Đang xử lý bước ${statusData.currentStep} / ${statusData.stepsCount}...`, 'Đang kết hợp hình ảnh và âm thanh...');
            } else if (statusData.status === 'completed') {
                clearInterval(pollInterval);
                showSuccessState(statusData.videoUrl);
            } else if (statusData.status === 'failed') {
                clearInterval(pollInterval);
                showFailedState(statusData.error);
            }
        } catch (e) {
            console.error('Polling error:', e);
            // We do not stop polling immediately on network hiccup, just display status
            processingStatusText.textContent = 'Mất kết nối tạm thời, đang thử lại...';
        }
    }, 1000);
}

function updateProgress(percent, stepInfoText, statusText) {
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressStepInfo.textContent = stepInfoText;
    processingStatusText.textContent = statusText;
}

function showSuccessState(videoUrl) {
    modalProcessingState.style.display = 'none';
    modalSuccessState.style.display = 'block';
    btnCloseModal.style.display = 'flex';

    // Set video elements
    finalVideoPlayer.src = videoUrl;
    btnDownloadVideo.href = videoUrl;
    btnDownloadVideo.download = `video_render_${Date.now()}.mp4`;
    
    showToast('Video đã render hoàn tất!', 4000);
    refreshExportsList();
}

function showFailedState(errorMessage) {
    modalProcessingState.style.display = 'none';
    modalFailedState.style.display = 'block';
    btnCloseModal.style.display = 'flex';
    
    errorLogMessage.textContent = errorMessage || 'Đã xảy ra lỗi không xác định trong quá trình render video.';
    showToast('Lỗi render video.', 4000);
}

// --- Project JSON Save/Load ---

function saveProject() {
    if (steps.length === 0) {
        showToast('Project của bạn rỗng!');
        return;
    }
    
    const resolution = document.querySelector('input[name="resolution"]:checked').value;
    const imageFit = document.querySelector('input[name="imageFit"]:checked').value;

    const projectData = {
        version: '1.0.0',
        timestamp: Date.now(),
        steps,
        resolution,
        imageFit,
        backgroundMusic
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `project_videomaker_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Đã lưu file cấu hình project.');
}

function triggerLoadProject() {
    projectFileInput.click();
}

function handleLoadProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const state = JSON.parse(e.target.result);
            if (state && Array.isArray(state.steps)) {
                steps = state.steps;
                
                if (state.resolution) {
                    const radio = document.querySelector(`input[name="resolution"][value="${state.resolution}"]`);
                    if (radio) radio.checked = true;
                }
                if (state.imageFit) {
                    const radio = document.querySelector(`input[name="imageFit"][value="${state.imageFit}"]`);
                    if (radio) radio.checked = true;
                }

                if (state.backgroundMusic) {
                    backgroundMusic = state.backgroundMusic;
                } else {
                    backgroundMusic = { path: null, name: null, volume: 0.15 };
                }
                updateBgmUI();

                renderSteps();
                autoSaveToLocalStorage();
                showToast('Đã tải lên project thành công!');
            } else {
                throw new Error('Format project không đúng');
            }
        } catch (err) {
            console.error(err);
            showToast('Lỗi: Định dạng file project không hợp lệ.');
        }
    };
    reader.readAsText(file);
    // Reset file input value so same file can be loaded again
    event.target.value = '';
}

// --- Initial Setup & Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    totalDurationBadge.id = 'total-duration-badge';
    totalDurationBadge.className = 'total-duration';
    totalDurationBadge.title = 'Tổng thời lượng video hiện tại';
    stepCountBadge.insertAdjacentElement('afterend', totalDurationBadge);

    // Try to load state from localStorage first
    loadFromLocalStorage();
    
    // If no steps loaded, add an empty initial step
    if (steps.length === 0) {
        steps.push({
            id: generateUniqueId(),
            imagePath: null,
            imageName: null,
            audioPath: null,
            audioName: null,
            duration: null,
            transition: 'none'
        });
    }

    renderSteps();
    renderDraftsList();
    refreshExportsList();

    // Event Listeners
    btnAddStep.addEventListener('click', () => {
        steps.push({
            id: generateUniqueId(),
            imagePath: null,
            imageName: null,
            audioPath: null,
            audioName: null,
            duration: null,
            transition: 'none'
        });
        renderSteps();
        autoSaveToLocalStorage();
        
        // Smooth scroll to bottom to show new step
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    });

    btnGenerateVideo.addEventListener('click', generateVideo);
    document.addEventListener('paste', handlePasteImage);
    
    btnSaveProject.addEventListener('click', saveAsDraft);
    btnLoadProject.addEventListener('click', triggerLoadProject);
    projectFileInput.addEventListener('change', handleLoadProject);

    // Library action buttons
    document.getElementById('btn-new-draft').addEventListener('click', createNewDraft);
    document.getElementById('btn-refresh-exports').addEventListener('click', refreshExportsList);

    // Modal close listeners
    const closeModalHandler = () => {
        // Pause video player if playing
        finalVideoPlayer.pause();
        exportModal.classList.remove('open');
        if (pollInterval) clearInterval(pollInterval);
    };

    btnCloseModal.addEventListener('click', closeModalHandler);
    btnCloseSuccess.addEventListener('click', closeModalHandler);
    btnCloseFailed.addEventListener('click', closeModalHandler);

    // Save configuration settings when radio options change
    document.querySelectorAll('input[name="resolution"]').forEach(radio => {
        radio.addEventListener('change', autoSaveToLocalStorage);
    });
    document.querySelectorAll('input[name="imageFit"]').forEach(radio => {
        radio.addEventListener('change', autoSaveToLocalStorage);
    });

    // --- Background Music Events ---
    if (bgmDropzone) {
        bgmDropzone.addEventListener('click', (e) => {
            if (e.target.closest('#btn-remove-bgm') || e.target.closest('#bgm-player')) return;
            fileInputBgm.click();
        });

        fileInputBgm.addEventListener('change', () => {
            if (fileInputBgm.files.length > 0) {
                uploadBgmFile(fileInputBgm.files[0]);
            }
        });

        setupDragDrop(bgmDropzone, (file) => uploadBgmFile(file));
    }

    if (btnRemoveBgm) {
        btnRemoveBgm.addEventListener('click', (e) => {
            e.stopPropagation();
            const pathToDelete = backgroundMusic.path;
            backgroundMusic.path = null;
            backgroundMusic.name = null;
            updateBgmUI();
            autoSaveToLocalStorage();
            if (pathToDelete) deleteFilesFromServer([pathToDelete]);
        });
    }

    if (bgmVolumeSlider) {
        bgmVolumeSlider.addEventListener('input', (e) => {
            const volVal = parseInt(e.target.value, 10);
            bgmVolumeValue.textContent = volVal + '%';
            backgroundMusic.volume = volVal / 100;
        });

        bgmVolumeSlider.addEventListener('change', () => {
            autoSaveToLocalStorage();
        });
    }
});

// --- Drafts & Exports Management ---

const DRAFTS_KEY = 'videomaker_drafts_list';
let currentActiveDraftId = null;

// Helper function to delete files from server
async function deleteFilesFromServer(filePaths) {
    const paths = filePaths.filter(p => p);
    if (paths.length === 0) return;

    try {
        const response = await fetch('/api/delete-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: paths })
        });
        const result = await response.json();
        console.log('Cleaned files from server:', result);
    } catch (err) {
        console.error('Failed to delete files from server:', err);
    }
}

// Save current project state as a draft in DRAFTS_KEY
function saveAsDraft() {
    if (steps.length === 0) {
        showToast('Project của bạn rỗng!');
        return;
    }

    const resolution = document.querySelector('input[name="resolution"]:checked').value;
    const imageFit = document.querySelector('input[name="imageFit"]:checked').value;

    const draftName = prompt('Nhập tên cho bản nháp này:', currentActiveDraftId ? '' : `Bản nháp ${new Date().toLocaleString('vi-VN')}`);
    if (draftName === null) return; // cancelled

    const savedDrafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    
    const draftData = {
        id: currentActiveDraftId || 'draft-' + Date.now(),
        name: draftName.trim() || `Bản nháp ${new Date().toLocaleString('vi-VN')}`,
        steps: JSON.parse(JSON.stringify(steps)), // deep copy
        resolution,
        imageFit,
        backgroundMusic: JSON.parse(JSON.stringify(backgroundMusic)),
        updatedAt: Date.now()
    };

    if (currentActiveDraftId) {
        const index = savedDrafts.findIndex(d => d.id === currentActiveDraftId);
        if (index !== -1) {
            // If they left the name blank, keep the old name
            if (!draftName.trim()) {
                draftData.name = savedDrafts[index].name;
            }
            savedDrafts[index] = draftData;
        } else {
            savedDrafts.push(draftData);
        }
    } else {
        savedDrafts.push(draftData);
        currentActiveDraftId = draftData.id;
    }

    localStorage.setItem(DRAFTS_KEY, JSON.stringify(savedDrafts));
    showToast('Đã lưu bản nháp thành công!');
    renderDraftsList();
    autoSaveToLocalStorage();
}

// Render the Drafts list in UI
function renderDraftsList() {
    const container = document.getElementById('drafts-list-container');
    if (!container) return;

    const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    
    if (drafts.length === 0) {
        container.innerHTML = `
            <div class="library-empty">
                <i class="fa-solid fa-file-signature"></i>
                <p>Chưa có bản nháp nào được lưu.</p>
            </div>
        `;
        return;
    }

    // Sort by updatedAt descending
    drafts.sort((a, b) => b.updatedAt - a.updatedAt);

    container.innerHTML = drafts.map(draft => {
        const dateStr = new Date(draft.updatedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        const isActive = draft.id === currentActiveDraftId ? '<span class="step-count" style="background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: #86efac; margin-right: 4px;">Đang chỉnh sửa</span>' : '';
        return `
            <div class="library-item" data-id="${draft.id}">
                <div class="item-info">
                    <div class="item-title" title="${draft.name}">${draft.name}</div>
                    <div class="item-meta">
                        <span><i class="fa-solid fa-layer-group"></i> ${draft.steps.length} bước</span>
                        <span><i class="fa-solid fa-clock"></i> ${dateStr}</span>
                        ${isActive}
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon btn-load-draft" title="Tiếp tục làm bản nháp này" onclick="loadDraft('${draft.id}')">
                        <i class="fa-solid fa-folder-open"></i>
                    </button>
                    <button class="btn-icon btn-danger-hover" title="Xóa bản nháp (Xóa toàn bộ ảnh/voice nháp liên quan)" onclick="deleteDraft('${draft.id}')">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Load a draft into the editor
function loadDraft(draftId) {
    const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return;

    // Confirm overwrite if there are changes
    if (steps.length > 0 && steps.some(s => s.imagePath || s.audioPath)) {
        if (!confirm('Bạn có chắc chắn muốn tải bản nháp này? Cấu hình đang soạn thảo hiện tại sẽ bị ghi đè.')) {
            return;
        }
    }

    steps = JSON.parse(JSON.stringify(draft.steps));
    currentActiveDraftId = draft.id;

    // Set resolution radio
    if (draft.resolution) {
        const radio = document.querySelector(`input[name="resolution"][value="${draft.resolution}"]`);
        if (radio) radio.checked = true;
    }
    // Set image fit radio
    if (draft.imageFit) {
        const radio = document.querySelector(`input[name="imageFit"][value="${draft.imageFit}"]`);
        if (radio) radio.checked = true;
    }

    // Load background music
    if (draft.backgroundMusic) {
        backgroundMusic = JSON.parse(JSON.stringify(draft.backgroundMusic));
    } else {
        backgroundMusic = { path: null, name: null, volume: 0.15 };
    }
    updateBgmUI();

    renderSteps();
    autoSaveToLocalStorage();
    renderDraftsList();
    showToast(`Đã tải bản nháp: ${draft.name}`);
}

// Delete a draft and clean up its files from the server
async function deleteDraft(draftId) {
    const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
    const draftIndex = drafts.findIndex(d => d.id === draftId);
    if (draftIndex === -1) return;

    const draftName = drafts[draftIndex].name;
    if (!confirm(`Bạn có chắc chắn muốn xóa bản nháp "${draftName}"?\nTất cả hình ảnh và âm thanh của bản nháp này sẽ bị xóa khỏi máy chủ.`)) {
        return;
    }

    const draft = drafts[draftIndex];
    // Collect all files to delete
    const filePaths = [];
    draft.steps.forEach(step => {
        if (step.imagePath) filePaths.push(step.imagePath);
        if (step.audioPath) filePaths.push(step.audioPath);
    });
    if (draft.backgroundMusic && draft.backgroundMusic.path) {
        filePaths.push(draft.backgroundMusic.path);
    }

    // Remove from localStorage
    drafts.splice(draftIndex, 1);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));

    if (currentActiveDraftId === draftId) {
        currentActiveDraftId = null;
    }

    renderDraftsList();
    showToast('Đã xóa bản nháp.');

    // Delete files from server
    await deleteFilesFromServer(filePaths);
}

// Create a new blank draft (reset editor)
function createNewDraft() {
    if (steps.length > 0 && steps.some(s => s.imagePath || s.audioPath)) {
        if (!confirm('Bạn có muốn tạo bản nháp mới? Cấu hình chưa lưu trên bảng chỉnh sửa hiện tại sẽ bị mất.')) {
            return;
        }
    }

    currentActiveDraftId = null;
    steps = [{
        id: generateUniqueId(),
        imagePath: null,
        imageName: null,
        audioPath: null,
        audioName: null,
        duration: null,
        transition: 'none'
    }];

    backgroundMusic = { path: null, name: null, volume: 0.15 };
    updateBgmUI();

    renderSteps();
    autoSaveToLocalStorage();
    renderDraftsList();
    showToast('Đã tạo bản soạn thảo mới.');
}

// Fetch and render the list of exported videos
async function refreshExportsList() {
    const container = document.getElementById('exports-list-container');
    if (!container) return;

    try {
        const response = await fetch('/api/exports');
        if (!response.ok) throw new Error('Failed to fetch exports');
        
        const videos = await response.json();

        if (videos.length === 0) {
            container.innerHTML = `
                <div class="library-empty">
                    <i class="fa-solid fa-film"></i>
                    <p>Chưa có video nào được xuất.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = videos.map(video => {
            const dateStr = new Date(video.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
            const sizeStr = (video.size / (1024 * 1024)).toFixed(2) + ' MB';
            const displayTitle = video.filename.replace('.mp4', '');

            return `
                <div class="library-item" data-filename="${video.filename}">
                    <div class="item-info">
                        <div class="item-title-wrapper" style="width:100%">
                            <div class="item-title" id="title-display-${video.filename}" title="${displayTitle}">${displayTitle}</div>
                        </div>
                        <div class="item-meta">
                            <span><i class="fa-solid fa-hdd"></i> ${sizeStr}</span>
                            <span><i class="fa-solid fa-calendar-day"></i> ${dateStr}</span>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon" title="Xem thử Video" onclick="previewExportedVideo('${video.url}')">
                            <i class="fa-regular fa-circle-play"></i>
                        </button>
                        <a href="${video.url}" download="${video.filename}" class="btn-icon" title="Tải xuống Video">
                            <i class="fa-solid fa-download"></i>
                        </a>
                        <button class="btn-icon" title="Đổi tên Video" onclick="renameExportedVideo('${video.filename}')">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn-icon btn-danger-hover" title="Xóa Video khỏi Google Drive" onclick="deleteExportedVideo('${video.filename}')">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div class="library-empty" style="color: var(--danger)">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>Lỗi tải danh sách video: ${err.message}</p>
            </div>
        `;
    }
}

// Preview an exported video in the modal player
function previewExportedVideo(videoUrl) {
    exportModal.classList.add('open');
    modalProcessingState.style.display = 'none';
    modalFailedState.style.display = 'none';
    modalSuccessState.style.display = 'block';
    btnCloseModal.style.display = 'flex';

    finalVideoPlayer.src = videoUrl;
    btnDownloadVideo.href = videoUrl;
    btnDownloadVideo.download = videoUrl.substring(videoUrl.lastIndexOf('/') + 1);
}

// Rename an exported video file on server
async function renameExportedVideo(filename) {
    const displayElement = document.getElementById(`title-display-${filename}`);
    if (!displayElement) return;

    const currentTitle = displayElement.textContent;
    const newTitle = prompt('Nhập tên mới cho video (không cần đuôi .mp4):', currentTitle);
    if (newTitle === null || !newTitle.trim()) return;

    const cleanNewTitle = newTitle.trim();
    if (cleanNewTitle === currentTitle) return;

    try {
        const response = await fetch('/api/exports/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldFilename: filename, newFilename: cleanNewTitle })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            showToast('Đã đổi tên video thành công!');
            refreshExportsList();
        } else {
            throw new Error(data.error || 'Failed to rename');
        }
    } catch (e) {
        console.error(e);
        alert(`Lỗi đổi tên: ${e.message}`);
    }
}

// Delete an exported video file from server
async function deleteExportedVideo(filename) {
    if (!confirm(`Bạn có chắc chắn muốn xóa video "${filename}" khỏi Google Drive? Hành động này không thể hoàn tác.`)) {
        return;
    }

    try {
        const response = await fetch('/api/exports/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            showToast('Đã xóa video thành công!');
            refreshExportsList();
        } else {
            throw new Error(data.error || 'Failed to delete');
        }
    } catch (e) {
        console.error(e);
        alert(`Lỗi xóa file: ${e.message}`);
    }
}

// Attach functions to window for onclick callbacks
window.loadDraft = loadDraft;
window.deleteDraft = deleteDraft;
window.previewExportedVideo = previewExportedVideo;
window.renameExportedVideo = renameExportedVideo;
window.deleteExportedVideo = deleteExportedVideo;
