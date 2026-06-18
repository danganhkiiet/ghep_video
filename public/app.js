// Application State
let steps = [];
let activeJobId = null;
let pollInterval = null;
let activeImageStepId = null;

// DOM Elements
const stepsContainer = document.getElementById('steps-container');
const btnAddStep = document.getElementById('btn-add-step');
const btnGenerateVideo = document.getElementById('btn-generate-video');
const stepCountBadge = document.getElementById('step-count-badge');
const totalDurationBadge = document.createElement('span');
const btnSaveProject = document.getElementById('btn-save-project');
const btnLoadProject = document.getElementById('btn-load-project');
const projectFileInput = document.getElementById('project-file-input');

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
        imageFit
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
                stepObj.imagePath = null;
                stepObj.imageName = null;
                renderSteps();
                autoSaveToLocalStorage();
            }
        });
    }

    const btnRemoveAud = stepCard.querySelector('.btn-remove-audio');
    if (btnRemoveAud) {
        btnRemoveAud.addEventListener('click', (e) => {
            e.stopPropagation();
            const stepObj = steps.find(s => s.id === id);
            if (stepObj) {
                stepObj.audioPath = null;
                stepObj.audioName = null;
                stepObj.duration = null;
                renderSteps();
                autoSaveToLocalStorage();
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
        steps = steps.filter(s => s.id !== id);
        renderSteps();
        autoSaveToLocalStorage();
        showToast('Đã xóa bước.');
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
            body: JSON.stringify({ steps, resolution, imageFit })
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
        imageFit
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
    
    btnSaveProject.addEventListener('click', saveProject);
    btnLoadProject.addEventListener('click', triggerLoadProject);
    projectFileInput.addEventListener('change', handleLoadProject);

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
});
