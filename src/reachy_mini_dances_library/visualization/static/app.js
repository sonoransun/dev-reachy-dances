/* Main application: state management, animation loop, API fetch logic. */

(async () => {
    // State
    let moveList = {};
    let currentData = null;
    let isPlaying = false;
    let animStartTime = null;
    let animBeatOffset = 0;
    let choreographySteps = null;
    let choreographyJson = null;

    // DOM elements
    const moveSelect = document.getElementById('move-select');
    const bpmSlider = document.getElementById('bpm-slider');
    const bpmValue = document.getElementById('bpm-value');
    const ampSlider = document.getElementById('amp-slider');
    const ampValue = document.getElementById('amp-value');
    const speedSelect = document.getElementById('speed-select');
    const playBtn = document.getElementById('play-btn');
    const beatCounter = document.getElementById('beat-counter');
    const descBar = document.getElementById('description-bar');
    const choreoUpload = document.getElementById('choreo-upload');

    // Initialize
    RobotScene.init();
    await loadMoves();
    await fetchCurrentMove();
    requestAnimationFrame(animLoop);

    // Event listeners
    moveSelect.addEventListener('change', () => {
        choreographyJson = null;
        choreographySteps = null;
        choreoUpload.value = '';
        fetchCurrentMove();
    });

    bpmSlider.addEventListener('input', () => {
        bpmValue.textContent = bpmSlider.value;
    });
    bpmSlider.addEventListener('change', fetchCurrentMove);

    ampSlider.addEventListener('input', () => {
        ampValue.textContent = parseFloat(ampSlider.value).toFixed(1);
    });
    ampSlider.addEventListener('change', fetchCurrentMove);

    playBtn.addEventListener('click', togglePlay);

    choreoUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            choreographyJson = JSON.parse(text);
            await fetchChoreography();
        } catch (err) {
            descBar.textContent = 'Error loading choreography: ' + err.message;
        }
    });

    async function loadMoves() {
        const resp = await fetch('/api/moves');
        const data = await resp.json();
        moveList = data.moves;

        moveSelect.innerHTML = '';
        for (const name of Object.keys(moveList)) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            moveSelect.appendChild(opt);
        }
    }

    async function fetchCurrentMove() {
        if (choreographyJson) {
            await fetchChoreography();
            return;
        }

        const moveName = moveSelect.value;
        const bpm = bpmSlider.value;
        const amp = ampSlider.value;

        const meta = moveList[moveName]?.metadata;
        if (meta) {
            descBar.textContent = meta.description || '';
        }

        const resp = await fetch(`/api/move/${moveName}?bpm=${bpm}&amplitude=${amp}`);
        currentData = await resp.json();
        choreographySteps = null;

        Plots.renderAll(currentData, null);
        resetAnimation();
        updatePoseAtBeat(0);
    }

    async function fetchChoreography() {
        const bpm = bpmSlider.value;
        const amp = ampSlider.value;

        const resp = await fetch(`/api/choreography?bpm=${bpm}&amplitude=${amp}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(choreographyJson),
        });
        currentData = await resp.json();
        choreographySteps = currentData.steps || null;

        descBar.textContent = 'Choreography: ' + (choreographySteps || []).map(s => s.move).join(' \u2192 ');

        Plots.renderAll(currentData, choreographySteps);
        resetAnimation();
        updatePoseAtBeat(0);
    }

    function togglePlay() {
        isPlaying = !isPlaying;
        if (isPlaying) {
            playBtn.innerHTML = '&#9646;&#9646; Pause';
            animStartTime = performance.now();
        } else {
            playBtn.innerHTML = '&#9654; Play';
            animBeatOffset = getCurrentBeat();
            animStartTime = null;
        }
    }

    function resetAnimation() {
        animBeatOffset = 0;
        animStartTime = isPlaying ? performance.now() : null;
    }

    function getCurrentBeat() {
        if (!currentData) return 0;
        if (!isPlaying) return animBeatOffset;

        const elapsed = (performance.now() - animStartTime) / 1000;
        const bpm = parseFloat(bpmSlider.value);
        const speed = parseFloat(speedSelect.value);
        return animBeatOffset + elapsed * (bpm / 60) * speed;
    }

    function updatePoseAtBeat(beat) {
        if (!currentData || !currentData.t_beats.length) return;

        const t = currentData.t_beats;
        const totalBeats = currentData.duration_beats || currentData.total_duration_beats || t[t.length - 1];
        const wrappedBeat = beat % totalBeats;
        const ch = currentData.channels;

        // Find interpolation index
        let idx = 0;
        for (let i = 0; i < t.length - 1; i++) {
            if (t[i + 1] > wrappedBeat) { idx = i; break; }
            idx = i;
        }
        const nextIdx = Math.min(idx + 1, t.length - 1);
        const span = t[nextIdx] - t[idx];
        const frac = span > 0 ? (wrappedBeat - t[idx]) / span : 0;

        function lerp(arr, i, j, f) {
            return arr[i] + (arr[j] - arr[i]) * f;
        }

        const values = {
            x: lerp(ch.x, idx, nextIdx, frac),
            y: lerp(ch.y, idx, nextIdx, frac),
            z: lerp(ch.z, idx, nextIdx, frac),
            roll: lerp(ch.roll, idx, nextIdx, frac),
            pitch: lerp(ch.pitch, idx, nextIdx, frac),
            yaw: lerp(ch.yaw, idx, nextIdx, frac),
            antenna_left: lerp(ch.antenna_left, idx, nextIdx, frac),
            antenna_right: lerp(ch.antenna_right, idx, nextIdx, frac),
        };

        RobotScene.updatePose(values);

        // Playhead fraction
        const playFrac = totalBeats > 0 ? wrappedBeat / totalBeats : 0;
        Plots.updatePlayhead(playFrac);
    }

    let lastPlotUpdate = 0;

    function animLoop(timestamp) {
        requestAnimationFrame(animLoop);

        if (isPlaying && currentData) {
            const beat = getCurrentBeat();
            const totalBeats = currentData.duration_beats || currentData.total_duration_beats || 0;
            const displayBeat = totalBeats > 0 ? beat % totalBeats : beat;
            beatCounter.textContent = 'Beat: ' + displayBeat.toFixed(2);
            updatePoseAtBeat(beat);
        }

        RobotScene.render();
    }
})();
