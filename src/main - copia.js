import '@spectrum-web-components/bundle/elements.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnCreate = document.querySelector('#btn-create');
    const btnOpen = document.querySelector('#btn-open');
    const fileSelector = document.querySelector('#file-selector');
    
    const panelHome = document.querySelector('#panel-home');
    const panelEditor = document.querySelector('#panel-editor');
    const logoHome = document.querySelector('#logo-home');
    const canvas = document.querySelector('#editor-stage');
    const ctx = canvas.getContext('2d');
    const templateCards = document.querySelectorAll('.template-card');
    
    const timelineTitle = document.querySelector('#timeline-title');
    const layerStatus = document.querySelector('#layer-status');

    // --- MOTOR VECTORIAL Y DOUGLAS-PEUCKER ---
    let vectors = [];       
    let currentPath = [];   
    let isDrawing = false;
    let currentTool = 'draw';

    const btnToolSelect = document.querySelector('#tool-select');
    const btnToolDraw = document.querySelector('#tool-draw');
    const btnToolBrush = document.querySelector('#tool-brush');
    const btnToolErase = document.querySelector('#tool-erase');

    const tools = [btnToolSelect, btnToolDraw, btnToolBrush, btnToolErase];

    function setActiveTool(selectedButton, toolName) {
        tools.forEach(btn => btn && btn.removeAttribute('selected'));
        if (selectedButton) selectedButton.setAttribute('selected', '');
        currentTool = toolName;
    }

    if (btnToolSelect) btnToolSelect.addEventListener('click', () => setActiveTool(btnToolSelect, 'select'));
    if (btnToolDraw) btnToolDraw.addEventListener('click', () => setActiveTool(btnToolDraw, 'draw'));
    if (btnToolBrush) btnToolBrush.addEventListener('click', () => setActiveTool(btnToolBrush, 'brush'));
    if (btnToolErase) btnToolErase.addEventListener('click', () => setActiveTool(btnToolErase, 'erase'));

    function getCanvasPos(evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (evt.clientX - rect.left) * (canvas.width / rect.width),
            y: (evt.clientY - rect.top) * (canvas.height / rect.height),
            pressure: evt.pressure !== undefined && evt.pressure > 0 ? evt.pressure : 0.5
        };
    }

    // --- ALGORITMO DE DOUGLAS-PEUCKER ---
    function perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const mag = Math.hypot(dx, dy);
        if (mag > 0) {
            const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
            const clampedU = Math.max(0, Math.min(1, u));
            const ix = lineStart.x + clampedU * dx;
            const iy = lineStart.y + clampedU * dy;
            return Math.hypot(point.x - ix, point.y - iy);
        }
        return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    }

    function douglasPeucker(points, tolerance) {
        if (points.length <= 2) return points;

        let maxDist = 0;
        let index = 0;
        const end = points.length - 1;

        for (let i = 1; i < end; i++) {
            const dist = perpendicularDistance(points[i], points[0], points[end]);
            if (dist > maxDist) {
                maxDist = dist;
                index = i;
            }
        }

        if (maxDist > tolerance) {
            const rec1 = douglasPeucker(points.slice(0, index + 1), tolerance);
            const rec2 = douglasPeucker(points.slice(index), tolerance);
            return rec1.slice(0, rec1.length - 1).concat(rec2);
        } else {
            return [points[0], points[end]];
        }
    }

    // --- RENDERIZADO VECTORIAL ---
    function redrawCanvas() {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        vectors.forEach(v => {
            if (v.points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(v.points[0].x, v.points[0].y);

            for (let i = 1; i < v.points.length - 1; i++) {
                const xc = (v.points[i].x + v.points[i + 1].x) / 2;
                const yc = (v.points[i].y + v.points[i + 1].y) / 2;
                ctx.quadraticCurveTo(v.points[i].x, v.points[i].y, xc, yc);
            }

            if (v.points.length > 1) {
                const last = v.points[v.points.length - 1];
                ctx.lineTo(last.x, last.y);
            }

            ctx.strokeStyle = v.color;
            ctx.lineWidth = v.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        });
    }

    // --- EVENTOS DE DIBUJO ---
    canvas.addEventListener('pointerdown', (e) => {
        if (currentTool === 'select') return;
        isDrawing = true;
        canvas.setPointerCapture(e.pointerId);

        const pos = getCanvasPos(e);
        currentPath = [pos];
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!isDrawing || currentTool === 'select') return;
        const pos = getCanvasPos(e);
        currentPath.push(pos);

        redrawCanvas();
        
        if (currentPath.length > 1) {
            ctx.beginPath();
            ctx.moveTo(currentPath[0].x, currentPath[0].y);
            for (let i = 1; i < currentPath.length; i++) {
                ctx.lineTo(currentPath[i].x, currentPath[i].y);
            }
            ctx.strokeStyle = currentTool === 'brush' ? '#378ef0' : '#000000';
            ctx.lineWidth = currentTool === 'brush' ? Math.max(2, pos.pressure * 12) : 2;
            ctx.stroke();
        }
    });

    canvas.addEventListener('pointerup', (e) => {
        if (!isDrawing) return;
        isDrawing = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}

        if (currentPath.length > 1) {
            const simplifiedPoints = douglasPeucker(currentPath, 1.5);

            let strokeColor = '#000000';
            let strokeWidth = 2;

            if (currentTool === 'brush') {
                strokeColor = '#378ef0';
                strokeWidth = 8;
            } else if (currentTool === 'erase') {
                strokeColor = '#ffffff';
                strokeWidth = 16;
            }

            vectors.push({
                points: simplifiedPoints,
                color: strokeColor,
                width: strokeWidth
            });
        }

        currentPath = [];
        redrawCanvas();
    });

    const openEditor = (width, height, title = "Untitled-1") => {
        panelHome.style.display = 'none';
        panelEditor.style.display = 'flex';
        
        if (width && height) {
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            canvas.width = width;
            canvas.height = height;
            vectors = [];
            redrawCanvas();
        }
        
        timelineTitle.textContent = `TIMELINE - ${title.toUpperCase()}`;
        layerStatus.textContent = `${title}`;
    };

    if (btnCreate) {
        btnCreate.addEventListener('click', () => openEditor(640, 360, "New Animation"));
    }

    if (btnOpen && fileSelector) {
        btnOpen.addEventListener('click', () => fileSelector.click());
        fileSelector.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) openEditor(640, 360, file.name);
        });
    }

    templateCards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('heading');
            if (type === 'Full HD') openEditor(800, 450, "Full HD Workspace");
            else if (type === 'Square') openEditor(400, 400, "Square Workspace");
        });
    });

    if (logoHome) {
        logoHome.addEventListener('click', () => {
            panelEditor.style.display = 'none';
            panelHome.style.display = 'flex';
            fileSelector.value = '';
        });
    }

    if ('launchQueue' in window && 'files' in LaunchParams.prototype) {
        window.launchQueue.setConsumer(async (launchParams) => {
            if (!launchParams.files.length) return;
            for (const fileHandle of launchParams.files) {
              const file = await fileHandle.getFile();
              openEditor(640, 360, file.name);
            }
        });
    }
});