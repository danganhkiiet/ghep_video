const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// Setup directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TEMP_DIR = path.join(__dirname, 'temp');
const EXPORTS_DIR = path.join(__dirname, 'exports');

[UPLOADS_DIR, TEMP_DIR, EXPORTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/exports', express.static(EXPORTS_DIR));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB file size limit
});

// Global jobs object to store generation progress
const jobs = {};

// Helper: Get audio duration in seconds
function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        exec(`"${ffmpegPath}" -i "${filePath}"`, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
            const output = stderr || '';
            const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
            if (match) {
                const hours = parseInt(match[1], 10);
                const minutes = parseInt(match[2], 10);
                const seconds = parseInt(match[3], 10);
                const hundredths = parseInt(match[4], 10);
                const duration = hours * 3600 + minutes * 60 + seconds + hundredths / 100;
                resolve(duration);
            } else {
                resolve(0); // fallback if parsing fails, let frontend duration handle it or default to 5s
            }
        });
    });
}

const TRANSITION_DURATION = 0.5;
const FLASH_TRANSITION_DURATION = 0.16;
const MOTION_FADE_DURATION = 0.25;
const MOTION_TRANSITIONS = new Set(['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down']);

function getTransitionDuration(transition) {
    if (transition === 'flash_white') return FLASH_TRANSITION_DURATION;
    if (MOTION_TRANSITIONS.has(transition)) return MOTION_FADE_DURATION;
    return TRANSITION_DURATION;
}

function buildStillImageFilter(width, height, fit, duration, transition) {
    const safeDuration = Math.max(parseFloat(duration) || 1, 1);
    const totalFrames = Math.max(Math.round(safeDuration * 30), 1);

    if (MOTION_TRANSITIONS.has(transition)) {
        // Use a scale factor of 3 for higher precision in coordinate math to eliminate jitter
        const scaleFactor = 3;
        const wHigh = width * scaleFactor;
        const hHigh = height * scaleFactor;

        let preScaleFilter = '';
        if (fit === 'cover') {
            preScaleFilter = `scale=w=${wHigh}:h=${hHigh}:force_original_aspect_ratio=increase,crop=w=${wHigh}:h=${hHigh}`;
        } else {
            preScaleFilter = `scale=w=${wHigh}:h=${hHigh}:force_original_aspect_ratio=decrease,pad=w=${wHigh}:h=${hHigh}:x=(ow-iw)/2:y=(oh-ih)/2:color=black`;
        }

        let zoomExpr = '';
        let xExpr = 'iw/2-(iw/zoom/2)';
        let yExpr = 'ih/2-(ih/zoom/2)';

        if (transition === 'zoom_in') {
            zoomExpr = `min(1.2,1.0+0.2*on/${totalFrames})`;
        } else if (transition === 'zoom_out') {
            zoomExpr = `max(1.0,1.2-0.2*on/${totalFrames})`;
        } else {
            // Panning transitions: keep zoom level constant to prevent wobble/jitter and non-uniform speed
            zoomExpr = '1.2';
            if (transition === 'pan_left') {
                xExpr = `(iw-iw/zoom)*(1-on/${totalFrames})`;
            } else if (transition === 'pan_right') {
                xExpr = `(iw-iw/zoom)*on/${totalFrames}`;
            } else if (transition === 'pan_up') {
                yExpr = `(ih-ih/zoom)*(1-on/${totalFrames})`;
            } else if (transition === 'pan_down') {
                yExpr = `(ih-ih/zoom)*on/${totalFrames}`;
            }
        }

        // Return both the pre-scale filter and the zoompan filter
        return [
            preScaleFilter,
            `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${width}x${height}:fps=30`
        ];
    }

    if (fit === 'cover') {
        return [`scale=w=${width}:h=${height}:force_original_aspect_ratio=increase,crop=w=${width}:h=${height}`];
    }

    return [`scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease,pad=w=${width}:h=${height}:x=(ow-iw)/2:y=(oh-ih)/2:color=black`];
}

function addTransitionInFilters(videoFilters, audioFilters, transition, duration) {
    const transitionDuration = getTransitionDuration(transition);
    if (duration <= transitionDuration) return;

    if (transition === 'fade') {
        videoFilters.push(`fade=t=in:st=0:d=${transitionDuration}:color=black`);
        audioFilters.push(`afade=t=in:ss=0:d=${transitionDuration}`);
    } else if (transition === 'fade_white' || transition === 'flash_white') {
        videoFilters.push(`fade=t=in:st=0:d=${transitionDuration}:color=white`);
        if (transition !== 'flash_white') {
            audioFilters.push(`afade=t=in:ss=0:d=${transitionDuration}`);
        }
    } else if (MOTION_TRANSITIONS.has(transition)) {
        videoFilters.push(`fade=t=in:st=0:d=${transitionDuration}:color=black`);
        audioFilters.push(`afade=t=in:ss=0:d=${transitionDuration}`);
    }
}

function addTransitionOutFilters(videoFilters, audioFilters, transition, duration) {
    const transitionDuration = getTransitionDuration(transition);
    if (duration <= transitionDuration) return;

    const start = Math.max(duration - transitionDuration, 0);
    if (transition === 'fade') {
        videoFilters.push(`fade=t=out:st=${start}:d=${transitionDuration}:color=black`);
        audioFilters.push(`afade=t=out:st=${start}:d=${transitionDuration}`);
    } else if (transition === 'fade_white' || transition === 'flash_white') {
        videoFilters.push(`fade=t=out:st=${start}:d=${transitionDuration}:color=white`);
        if (transition !== 'flash_white') {
            audioFilters.push(`afade=t=out:st=${start}:d=${transitionDuration}`);
        }
    } else if (MOTION_TRANSITIONS.has(transition)) {
        videoFilters.push(`fade=t=out:st=${start}:d=${transitionDuration}:color=black`);
        audioFilters.push(`afade=t=out:st=${start}:d=${transitionDuration}`);
    }
}

// Endpoint: File upload
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const relativePath = `uploads/${req.file.filename}`;
        const absolutePath = req.file.path;
        const fileType = req.file.mimetype;

        let duration = null;
        if (fileType.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.ogg', '.aac'].some(ext => req.file.filename.toLowerCase().endsWith(ext))) {
            duration = await getAudioDuration(absolutePath);
        }

        res.json({
            success: true,
            filename: req.file.filename,
            path: relativePath,
            mimetype: fileType,
            duration: duration
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Internal server error during upload' });
    }
});

// Endpoint: Trigger video generation
app.post('/api/generate', (req, res) => {
    const { steps, resolution, imageFit } = req.body;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: 'Steps are required and must be an array' });
    }

    // Parse width and height from resolution (e.g. "1920x1080")
    const resParts = (resolution || '1920x1080').split('x');
    const width = parseInt(resParts[0], 10) || 1920;
    const height = parseInt(resParts[1], 10) || 1080;
    const fit = imageFit || 'contain';

    const jobId = 'job-' + Date.now();
    jobs[jobId] = {
        status: 'processing',
        progress: 0,
        videoUrl: null,
        error: null,
        stepsCount: steps.length,
        currentStep: 0
    };

    // Run processing asynchronously
    processVideoJob(jobId, steps, width, height, fit);

    res.json({ success: true, jobId });
});

// Endpoint: Get job status
app.get('/api/status/:jobId', (req, res) => {
    const job = jobs[req.params.jobId];
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
});

// Async function to handle video rendering and concatenation
async function processVideoJob(jobId, steps, width, height, fit) {
    const job = jobs[jobId];
    const tempFiles = [];

    try {
        const renderedStepPaths = [];

        // 1. Render each step's video segment
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const stepIndex = i;

            job.currentStep = stepIndex + 1;
            
            // Calculate intermediate progress (0 to 85%)
            job.progress = Math.round((stepIndex / steps.length) * 85);

            // Absolute paths
            const imgAbsPath = path.join(__dirname, step.imagePath);
            const audioAbsPath = path.join(__dirname, step.audioPath);
            const stepVideoFilename = `step_${jobId}_${stepIndex}.mp4`;
            const stepVideoAbsPath = path.join(TEMP_DIR, stepVideoFilename);

            tempFiles.push(stepVideoAbsPath);
            renderedStepPaths.push(stepVideoFilename);

            // Get exact duration of audio again to make sure
            let duration = parseFloat(step.duration);
            if (isNaN(duration) || duration <= 0) {
                duration = await getAudioDuration(audioAbsPath);
                if (duration <= 0) duration = 5.0; // fallback to 5 seconds
            }

            // Build dynamic filters for this step
            let stepVfFilters = [];
            let stepAfFilters = [];

            // Base image transform and optional motion effect
            stepVfFilters.push(...buildStillImageFilter(width, height, fit, duration, step.transition));

            // Check if we need fade-in from previous step's transition
            if (i > 0 && duration > 0.5) {
                const prevStep = steps[i - 1];
                addTransitionInFilters(stepVfFilters, stepAfFilters, prevStep.transition, duration);
            }

            // Check if we need fade-out for current step's transition
            if (i < steps.length - 1 && duration > 0.5) {
                addTransitionOutFilters(stepVfFilters, stepAfFilters, step.transition, duration);
            }

            const vfFilterString = stepVfFilters.join(',');
            const afFilterString = stepAfFilters.length > 0 ? `-af "${stepAfFilters.join(',')}"` : '';

            console.log(`[Job ${jobId}] Rendering step ${stepIndex} with duration ${duration}s...`);

            // ffmpeg command to create step video segment with visually lossless quality (CRF 18) and high quality audio (48kHz)
            const renderCmd = `"${ffmpegPath}" -y -loop 1 -r 30 -i "${imgAbsPath}" -i "${audioAbsPath}" -vf "${vfFilterString}" ${afFilterString} -c:v libx264 -crf 18 -preset medium -c:a aac -ar 48000 -ac 2 -b:a 192k -pix_fmt yuv420p -t ${duration} "${stepVideoAbsPath}"`;

            await new Promise((resolve, reject) => {
                exec(renderCmd, { maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
                    if (err) {
                        console.error(`[Job ${jobId}] Error rendering step ${stepIndex}:`, stderr);
                        reject(new Error(`Failed to render step ${stepIndex + 1}: ${err.message}`));
                    } else {
                        resolve();
                    }
                });
            });
        }

        // 2. Concatenate step videos
        job.progress = 90;
        console.log(`[Job ${jobId}] Concatenating segments...`);

        const concatTxtFilename = `concat_${jobId}.txt`;
        const concatTxtAbsPath = path.join(TEMP_DIR, concatTxtFilename);
        tempFiles.push(concatTxtAbsPath);

        // Write filenames to concat text file
        const fileContent = renderedStepPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(concatTxtAbsPath, fileContent, 'utf8');

        // Output final video file
        const finalVideoFilename = `final_${jobId}.mp4`;
        const finalVideoAbsPath = path.join(EXPORTS_DIR, finalVideoFilename);

        // Run concat demuxer (cwd set to TEMP_DIR so we can use relative filenames safely)
        const concatCmd = `"${ffmpegPath}" -y -f concat -safe 0 -i "${concatTxtFilename}" -c copy "${finalVideoAbsPath}"`;

        await new Promise((resolve, reject) => {
            exec(concatCmd, { cwd: TEMP_DIR, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
                if (err) {
                    console.error(`[Job ${jobId}] Concat error:`, stderr);
                    reject(new Error(`Failed to concatenate video segments: ${err.message}`));
                } else {
                    resolve();
                }
            });
        });

        // 3. Mark complete
        job.progress = 100;
        job.status = 'completed';
        job.videoUrl = `/exports/${finalVideoFilename}`;
        console.log(`[Job ${jobId}] Rendered successfully: ${finalVideoFilename}`);

    } catch (error) {
        console.error(`[Job ${jobId}] Process failed:`, error);
        job.status = 'failed';
        job.error = error.message;
    } finally {
        // Cleanup temp files
        setTimeout(() => {
            tempFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    try {
                        fs.unlinkSync(file);
                    } catch (e) {
                        console.error(`Failed to delete temp file ${file}:`, e);
                    }
                }
            });
        }, 10000); // Wait 10 seconds before deleting to ensure files are released
    }
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
