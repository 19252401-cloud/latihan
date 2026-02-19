document.addEventListener('DOMContentLoaded', function () {
    const videoInput = document.getElementById('videoInput');
    const fileName = document.getElementById('fileName');
    const videoPreview = document.getElementById('videoPreview');
    const sourceVideo = document.getElementById('sourceVideo');
    const videoDuration = document.getElementById('videoDuration');
    const loopCountEl = document.getElementById('loopCount');
    const targetDurationEl = document.getElementById('targetDuration');
    const targetMinutesInput = document.getElementById('targetMinutes');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const progressSection = document.getElementById('progressSection');
    const progressFill = document.getElementById('progressFill');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    const currentLoopEl = document.getElementById('currentLoop');
    const totalLoopsEl = document.getElementById('totalLoops');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const resultSection = document.getElementById('resultSection');
    const resultVideo = document.getElementById('resultVideo');
    const downloadBtn = document.getElementById('downloadBtn');

    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let startTime = 0;
    let loopNumber = 0;
    let totalLoops = 0;
    let targetSeconds = 1800; // 30 minutes
    let animationId = null;
    let videoFile = null;

    videoInput.addEventListener('change', handleVideoSelect);
    targetMinutesInput.addEventListener('change', updateTargetDuration);
    startBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);

    function handleVideoSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        videoFile = file;
        fileName.textContent = file.name;

        const url = URL.createObjectURL(file);
        sourceVideo.src = url;
        sourceVideo.load();

        sourceVideo.addEventListener('loadedmetadata', function onMeta() {
            sourceVideo.removeEventListener('loadedmetadata', onMeta);

            const duration = sourceVideo.duration;
            videoDuration.textContent = duration.toFixed(1);

            updateTargetDuration();

            videoPreview.hidden = false;
            startBtn.disabled = false;
        });
    }

    function updateTargetDuration() {
        const minutes = parseInt(targetMinutesInput.value) || 30;
        targetSeconds = minutes * 60;
        targetDurationEl.textContent = minutes;
        totalTimeEl.textContent = formatTime(targetSeconds);

        if (sourceVideo.duration) {
            totalLoops = Math.ceil(targetSeconds / sourceVideo.duration);
            loopCountEl.textContent = totalLoops;
            totalLoopsEl.textContent = totalLoops;
        }
    }

    function startRecording() {
        if (!videoFile || isRecording) return;

        resultSection.hidden = true;
        progressSection.hidden = false;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        recordedChunks = [];
        loopNumber = 0;
        isRecording = true;

        canvas.width = sourceVideo.videoWidth || 640;
        canvas.height = sourceVideo.videoHeight || 360;

        sourceVideo.currentTime = 0;
        sourceVideo.loop = true;
        sourceVideo.muted = true;

        const stream = canvas.captureStream(30);

        try {
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaElementSource(sourceVideo);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            source.connect(audioCtx.destination);
            dest.stream.getAudioTracks().forEach(function (track) {
                stream.addTrack(track);
            });
        } catch (e) {
            // Video may not have audio, continue without it
        }

        const mimeType = getPreferredMimeType();
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: 2500000
        });

        mediaRecorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = function () {
            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
            const blob = new Blob(recordedChunks, { type: mimeType });
            const url = URL.createObjectURL(blob);

            resultVideo.src = url;
            downloadBtn.href = url;
            downloadBtn.download = 'video-looped-30min.' + ext;
            resultSection.hidden = false;

            startBtn.disabled = false;
            stopBtn.disabled = true;
            isRecording = false;
        };

        mediaRecorder.start(1000);
        startTime = Date.now();

        sourceVideo.play().then(function () {
            drawFrame();
        });

        sourceVideo.addEventListener('ended', onVideoEnded);
        sourceVideo.addEventListener('seeked', onVideoSeeked);
    }

    function getPreferredMimeType() {
        var types = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];
        for (var i = 0; i < types.length; i++) {
            if (MediaRecorder.isTypeSupported(types[i])) {
                return types[i];
            }
        }
        return 'video/webm';
    }

    function onVideoEnded() {
        if (!isRecording) return;
        loopNumber++;
        currentLoopEl.textContent = loopNumber;

        if (loopNumber >= totalLoops || getElapsed() >= targetSeconds) {
            stopRecording();
            return;
        }

        sourceVideo.currentTime = 0;
        sourceVideo.play();
    }

    function onVideoSeeked() {
        // Continue playback after seek
    }

    function drawFrame() {
        if (!isRecording) return;

        ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);

        var elapsed = getElapsed();
        currentTimeEl.textContent = formatTime(elapsed);

        var progress = Math.min((elapsed / targetSeconds) * 100, 100);
        progressFill.style.width = progress + '%';

        if (elapsed >= targetSeconds) {
            stopRecording();
            return;
        }

        animationId = requestAnimationFrame(drawFrame);
    }

    function getElapsed() {
        return (Date.now() - startTime) / 1000;
    }

    function stopRecording() {
        isRecording = false;
        sourceVideo.loop = false;
        sourceVideo.pause();
        sourceVideo.removeEventListener('ended', onVideoEnded);
        sourceVideo.removeEventListener('seeked', onVideoSeeked);

        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }

        stopBtn.disabled = true;
    }

    function formatTime(seconds) {
        var mins = Math.floor(seconds / 60);
        var secs = Math.floor(seconds % 60);
        return pad(mins) + ':' + pad(secs);
    }

    function pad(num) {
        return num < 10 ? '0' + num : '' + num;
    }
});
