/* Plotly 2D chart rendering for dance move channels. */

const Plots = (() => {
    const COLORS = {
        x: '#ff6b6b', y: '#51cf66', z: '#339af0',
        roll: '#ff922b', pitch: '#cc5de8', yaw: '#20c997',
        antenna_left: '#ffd43b', antenna_right: '#ff8787',
    };

    let currentData = null;
    let steps = null;

    function renderAll(data, stepBoundaries) {
        currentData = data;
        steps = stepBoundaries || null;

        const t = data.t_beats;
        const ch = data.channels;

        const stepShapes = _buildStepShapes();
        const stepAnnotations = _buildStepAnnotations();

        const layoutBase = {
            paper_bgcolor: '#0a0a1a',
            plot_bgcolor: '#0a0a1a',
            font: { color: '#a0a0c0', size: 10 },
            margin: { l: 50, r: 10, t: 24, b: 30 },
            legend: { orientation: 'h', y: 1.15, font: { size: 10 } },
            xaxis: { title: '', gridcolor: '#1a1a3e', zeroline: false },
            yaxis: { gridcolor: '#1a1a3e', zeroline: true, zerolinecolor: '#333' },
        };

        // Position plot
        Plotly.react('plot-position', [
            { x: t, y: ch.x, name: 'x (m)', line: { color: COLORS.x, width: 1.5 } },
            { x: t, y: ch.y, name: 'y (m)', line: { color: COLORS.y, width: 1.5 } },
            { x: t, y: ch.z, name: 'z (m)', line: { color: COLORS.z, width: 1.5 } },
        ], {
            ...layoutBase,
            title: { text: 'Position', font: { size: 12 } },
            shapes: stepShapes,
            annotations: stepAnnotations,
        }, { responsive: true, displayModeBar: false });

        // Orientation plot
        Plotly.react('plot-orientation', [
            { x: t, y: ch.roll, name: 'roll (rad)', line: { color: COLORS.roll, width: 1.5 } },
            { x: t, y: ch.pitch, name: 'pitch (rad)', line: { color: COLORS.pitch, width: 1.5 } },
            { x: t, y: ch.yaw, name: 'yaw (rad)', line: { color: COLORS.yaw, width: 1.5 } },
        ], {
            ...layoutBase,
            title: { text: 'Orientation', font: { size: 12 } },
            shapes: stepShapes,
        }, { responsive: true, displayModeBar: false });

        // Antenna plot
        Plotly.react('plot-antennas', [
            { x: t, y: ch.antenna_left, name: 'left (rad)', line: { color: COLORS.antenna_left, width: 1.5 } },
            { x: t, y: ch.antenna_right, name: 'right (rad)', line: { color: COLORS.antenna_right, width: 1.5 } },
        ], {
            ...layoutBase,
            title: { text: 'Antennas', font: { size: 12 } },
            xaxis: { ...layoutBase.xaxis, title: 'Beats' },
            shapes: stepShapes,
        }, { responsive: true, displayModeBar: false });

        _ensurePlayheads();
    }

    function _buildStepShapes() {
        if (!steps || steps.length <= 1) return [];
        return steps.slice(1).map(s => ({
            type: 'line',
            x0: s.start_beat, x1: s.start_beat,
            y0: 0, y1: 1,
            yref: 'paper',
            line: { color: '#e94560', width: 1, dash: 'dash' },
        }));
    }

    function _buildStepAnnotations() {
        if (!steps || steps.length === 0) return [];
        return steps.map(s => ({
            x: (s.start_beat + s.end_beat) / 2,
            y: 1,
            yref: 'paper',
            text: s.move,
            showarrow: false,
            font: { size: 9, color: '#e94560' },
        }));
    }

    function _ensurePlayheads() {
        ['plot-position', 'plot-orientation', 'plot-antennas'].forEach(id => {
            const el = document.getElementById(id);
            if (!el.querySelector('.playhead')) {
                const ph = document.createElement('div');
                ph.className = 'playhead';
                ph.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;background:#e94560;pointer-events:none;z-index:10;left:0;display:none;';
                el.appendChild(ph);
            }
        });
    }

    /**
     * Update playhead position as a fraction of total duration.
     * @param {number} fraction - 0 to 1
     */
    function updatePlayhead(fraction) {
        ['plot-position', 'plot-orientation', 'plot-antennas'].forEach(id => {
            const el = document.getElementById(id);
            const ph = el.querySelector('.playhead');
            if (!ph) return;

            // The nsewdrag rect is the Plotly drag overlay that exactly
            // covers the axes plot area — a stable public DOM element.
            const dragRect = el.querySelector('rect.nsewdrag');
            if (!dragRect) return;

            const containerRect = el.getBoundingClientRect();
            const axisRect = dragRect.getBoundingClientRect();

            const left = axisRect.left - containerRect.left;
            const width = axisRect.width;

            ph.style.display = 'block';
            ph.style.left = (left + fraction * width) + 'px';
            ph.style.top = (axisRect.top - containerRect.top) + 'px';
            ph.style.height = axisRect.height + 'px';
        });
    }

    return { renderAll, updatePlayhead };
})();
