import '@spectrum-web-components/bundle/elements.js';
import JSZip from 'jszip';

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

    // --- ELEMENTOS DE SPECTRUM Y VENTANA FLOTANTE ---
    const menuBtnInsert = document.querySelector('#menu-btn-insert');
    const dropdownInsert = document.querySelector('#dropdown-insert');
    const btnMenuNewSymbol = document.querySelector('#btn-menu-new-symbol');

    const contextMenuPopover = document.querySelector('#stage-context-menu');
    const ctxCut = document.querySelector('#ctx-cut');
    const ctxCopy = document.querySelector('#ctx-copy');
    const ctxPaste = document.querySelector('#ctx-paste');
    const ctxDelete = document.querySelector('#ctx-delete');
    const ctxConvertSymbol = document.querySelector('#ctx-convert-symbol');

    const desktopWindow = document.querySelector('#desktop-window-symbol');
    const windowDragHandle = document.querySelector('#window-drag-handle');
    const btnWindowClose = document.querySelector('#btn-window-close');
    const symbolNameInput = document.querySelector('#symbol-name');
    const symbolTypePicker = document.querySelector('#symbol-type');
    const btnModalOk = document.querySelector('#btn-modal-ok');
    const btnModalCancel = document.querySelector('#btn-modal-cancel');

    // --- ESTRUCTURA DE DATOS Y MOTOR VECTORIAL ---
    let vectors = [];       
    let currentPath = [];   
    let isDrawing = false;
    let currentTool = 'select';

    let selectedVectorIndex = -1;
    let clipboard = null;
    let symbolsLibrary = []; 
    let symbolCounter = 1;

    const btnToolSelect = document.querySelector('#tool-select');
    const btnToolDraw = document.querySelector('#tool-draw');
    const btnToolBrush = document.querySelector('#tool-brush');
    const btnToolErase = document.querySelector('#tool-erase');

    const tools = [btnToolSelect, btnToolDraw, btnToolBrush, btnToolErase];

    function setActiveTool(selectedButton, toolName) {
        tools.forEach(btn => btn && btn.removeAttribute('selected'));
        if (selectedButton) selectedButton.setAttribute('selected', '');
        currentTool = toolName;

        if (currentTool !== 'select') {
            selectedVectorIndex = -1;
            redrawCanvas();
        }
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

    // --- CÁLCULO DE BOUNDING BOX ---
    function getVectorBoundingBox(vector) {
        if (!vector.points || vector.points.length === 0) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        vector.points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        const padding = vector.width / 2 + 4;
        return {
            x: minX - padding,
            y: minY - padding,
            width: (maxX - minX) + padding * 2,
            height: (maxY - minY) + padding * 2
        };
    }

    function isPointInBoundingBox(pt, box) {
        return box && pt.x >= box.x && pt.x <= box.x + box.width &&
                      pt.y >= box.y && pt.y <= box.y + box.height;
    }

    // --- DOUGLAS-PEUCKER ---
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

        vectors.forEach((v, index) => {
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

            if (index === selectedVectorIndex) {
                const box = getVectorBoundingBox(v);
                if (box) {
                    ctx.save();
                    ctx.strokeStyle = '#378ef0';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.strokeRect(box.x, box.y, box.width, box.height);

                    ctx.fillStyle = '#378ef0';
                    ctx.fillRect(box.x - 3, box.y - 3, 6, 6);
                    ctx.fillRect(box.x + box.width - 3, box.y - 3, 6, 6);
                    ctx.fillRect(box.x - 3, box.y + box.height - 3, 6, 6);
                    ctx.fillRect(box.x + box.width - 3, box.y + box.height - 3, 6, 6);
                    ctx.restore();
                }
            }
        });
    }

    // --- EVENTOS DE CANVAS ---
    canvas.addEventListener('pointerdown', (e) => {
        hideMenus();
        const pos = getCanvasPos(e);

        if (e.button === 2) return; 

        if (currentTool === 'select') {
            selectedVectorIndex = -1;
            for (let i = vectors.length - 1; i >= 0; i--) {
                const box = getVectorBoundingBox(vectors[i]);
                if (isPointInBoundingBox(pos, box)) {
                    selectedVectorIndex = i;
                    break;
                }
            }
            redrawCanvas();
            return;
        }

        isDrawing = true;
        canvas.setPointerCapture(e.pointerId);
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
                width: strokeWidth,
                isSymbol: false
            });
        }

        currentPath = [];
        redrawCanvas();
    });

    // --- MENÚ CONTEXTUAL Y POPOVERS ---
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        hideMenus();

        const pos = getCanvasPos(e);

        if (selectedVectorIndex === -1) {
            for (let i = vectors.length - 1; i >= 0; i--) {
                const box = getVectorBoundingBox(vectors[i]);
                if (isPointInBoundingBox(pos, box)) {
                    selectedVectorIndex = i;
                    redrawCanvas();
                    break;
                }
            }
        }

        contextMenuPopover.style.top = `${e.clientY}px`;
        contextMenuPopover.style.left = `${e.clientX}px`;
        contextMenuPopover.setAttribute('open', '');
    });

    if (menuBtnInsert) {
        menuBtnInsert.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdownInsert.hasAttribute('open');
            hideMenus();
            if (!isOpen) {
                const rect = menuBtnInsert.getBoundingClientRect();
                dropdownInsert.style.top = `${rect.bottom}px`;
                dropdownInsert.style.left = `${rect.left}px`;
                dropdownInsert.setAttribute('open', '');
            }
        });
    }

    function hideMenus() {
        if (dropdownInsert) dropdownInsert.removeAttribute('open');
        if (contextMenuPopover) contextMenuPopover.removeAttribute('open');
    }

    document.addEventListener('click', () => hideMenus());

    // --- VENTANA FLOTANTE DE SÍMBOLO ---
    function openSymbolModal() {
        hideMenus();
        symbolNameInput.value = `Symbol ${symbolCounter}`;
        desktopWindow.style.display = 'flex';
    }

    function closeSymbolModal() {
        desktopWindow.style.display = 'none';
    }

    btnMenuNewSymbol.addEventListener('click', () => openSymbolModal());
    if (ctxConvertSymbol) ctxConvertSymbol.addEventListener('click', () => openSymbolModal());

    if (btnWindowClose) btnWindowClose.addEventListener('click', () => closeSymbolModal());
    if (btnModalCancel) btnModalCancel.addEventListener('click', () => closeSymbolModal());

    if (btnModalOk) {
        btnModalOk.addEventListener('click', () => {
            const name = symbolNameInput.value.trim() || `Symbol ${symbolCounter}`;
            const type = symbolTypePicker.value;

            let symbolData = null;
            if (selectedVectorIndex !== -1) {
                symbolData = JSON.parse(JSON.stringify(vectors[selectedVectorIndex]));
                vectors[selectedVectorIndex].isSymbol = true;
                vectors[selectedVectorIndex].symbolName = name;
            }

            symbolsLibrary.push({
                name: name,
                type: type,
                data: symbolData
            });

            symbolCounter++;
            closeSymbolModal();
            redrawCanvas();
        });
    }

    // --- ARRASTRAR VENTANA FLOTANTE ---
    let isDraggingWindow = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    windowDragHandle.addEventListener('mousedown', (e) => {
        isDraggingWindow = true;
        dragOffsetX = e.clientX - desktopWindow.offsetLeft;
        dragOffsetY = e.clientY - desktopWindow.offsetTop;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingWindow) return;
        desktopWindow.style.left = `${e.clientX - dragOffsetX}px`;
        desktopWindow.style.top = `${e.clientY - dragOffsetY}px`;
    });

    document.addEventListener('mouseup', () => {
        isDraggingWindow = false;
    });

    // --- OPERACIONES DE DIBUJO Y PORTAPAPELES ---
    function copySelected() {
        if (selectedVectorIndex !== -1) {
            clipboard = JSON.parse(JSON.stringify(vectors[selectedVectorIndex]));
        }
    }

    function cutSelected() {
        if (selectedVectorIndex !== -1) {
            copySelected();
            deleteSelected();
        }
    }

    function pasteSelected() {
        if (clipboard) {
            const pasted = JSON.parse(JSON.stringify(clipboard));
            pasted.points.forEach(p => {
                p.x += 15;
                p.y += 15;
            });
            vectors.push(pasted);
            selectedVectorIndex = vectors.length - 1;
            redrawCanvas();
        }
    }

    function deleteSelected() {
        if (selectedVectorIndex !== -1) {
            vectors.splice(selectedVectorIndex, 1);
            selectedVectorIndex = -1;
            redrawCanvas();
        }
    }

    if (ctxCopy) ctxCopy.addEventListener('click', () => copySelected());
    if (ctxCut) ctxCut.addEventListener('click', () => cutSelected());
    if (ctxPaste) ctxPaste.addEventListener('click', () => pasteSelected());
    if (ctxDelete) ctxDelete.addEventListener('click', () => deleteSelected());

    // --- ATAJOS DE TECLADO ---
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F8') {
            e.preventDefault();
            openSymbolModal();
            return;
        }

        if (e.ctrlKey && e.key.toLowerCase() === 'c') copySelected();
        if (e.ctrlKey && e.key.toLowerCase() === 'x') cutSelected();
        if (e.ctrlKey && e.key.toLowerCase() === 'v') pasteSelected();
        if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    });

    // --- PARSER DE ARCHIVOS .FLA REALES (CS6 / Animate ZIP) ---
    async function loadRealFlaFile(file) {
        try {
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(file);

            let domDocumentFile = zipContent.file("DOMDocument.xml");
            if (!domDocumentFile) {
                const allFiles = Object.keys(zipContent.files);
                const foundPath = allFiles.find(name => name.endsWith("DOMDocument.xml"));
                if (foundPath) domDocumentFile = zipContent.file(foundPath);
            }

            let stageWidth = 640;
            let stageHeight = 360;

            if (domDocumentFile) {
                const xmlText = await domDocumentFile.async("text");
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");

                const docElement = xmlDoc.querySelector("DOMDocument") || xmlDoc.documentElement;
                if (docElement) {
                    const w = docElement.getAttribute("width");
                    const h = docElement.getAttribute("height");
                    if (w) stageWidth = parseInt(w, 10);
                    if (h) stageHeight = parseInt(h, 10);
                }

                // Extraer vectores de las formas de Flash
                vectors = [];
                selectedVectorIndex = -1;
                const shapeElements = xmlDoc.querySelectorAll("DOMShape");
                for (const shapeEl of shapeElements) {
                    const parsedVectors = parseXFLShape(shapeEl);
                    vectors.push(...parsedVectors);
                }
            }

            openEditor(stageWidth, stageHeight, file.name);
            redrawCanvas();
        } catch (error) {
            console.error("[OpenFlash] Error al descomponer el archivo .fla:", error);
            openEditor(640, 360, file.name);
        }
    }

    // --- DECODIFICADOR DE TRAZADOS XFL ---
    function parseXFLShape(shapeEl) {
        const extractedVectors = [];
        const edgeElements = shapeEl.querySelectorAll("Edge");
        const COORD_SCALE = 20; // Twips de Adobe Flash

        for (const edgeEl of edgeElements) {
            const edgesAttr = edgeEl.getAttribute("edges") || edgeEl.getAttribute("cubics") || "";
            const points = parseEdgeString(edgesAttr, COORD_SCALE);
            if (points.length > 1) {
                extractedVectors.push({
                    points: points,
                    color: '#378ef0',
                    width: 2,
                    isSymbol: false
                });
            }
        }
        return extractedVectors;
    }

    function parseEdgeString(edgeStr, scale) {
        const tokens = edgeStr.trim().split(/\s+/);
        const points = [];
        let i = 0;

        while (i < tokens.length) {
            const token = tokens[i];
            if (token.startsWith('!')) {
                let xVal = parseFloat(token.substring(1));
                let yVal = parseFloat(tokens[i+1]);
                if (!isNaN(xVal) && !isNaN(yVal)) {
                    points.push({ x: xVal / scale, y: yVal / scale });
                }
                i += 3;
            } else if (token === '|' || token === '/') {
                let xVal = parseFloat(tokens[i+1]);
                let yVal = parseFloat(tokens[i+2]);
                if (!isNaN(xVal) && !isNaN(yVal)) {
                    points.push({ x: xVal / scale, y: yVal / scale });
                }
                i += 3;
            } else if (token === '[') {
                let cx = parseFloat(tokens[i+1]) / scale;
                let cy = parseFloat(tokens[i+2]) / scale;
                let x = parseFloat(tokens[i+3]) / scale;
                let y = parseFloat(tokens[i+4]) / scale;
                if (!isNaN(x) && !isNaN(y)) {
                    points.push({ x: cx, y: cy });
                    points.push({ x: x, y: y });
                }
                i += 5;
            } else {
                i++;
            }
        }
        return points;
    }

    // --- GESTIÓN DE PANTALLAS ---
    const openEditor = (width, height, title = "Untitled-1") => {
        panelHome.style.display = 'none';
        panelEditor.style.display = 'flex';
        
        if (width && height) {
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            canvas.width = width;
            canvas.height = height;
            redrawCanvas();
        }
        
        timelineTitle.textContent = `TIMELINE - ${title.toUpperCase()}`;
        layerStatus.textContent = `${title}`;
    };

    if (btnCreate) {
        btnCreate.addEventListener('click', () => {
            vectors = [];
            selectedVectorIndex = -1;
            openEditor(640, 360, "New Animation");
            redrawCanvas();
        });
    }

    if (btnOpen && fileSelector) {
        btnOpen.addEventListener('click', () => fileSelector.click());
        fileSelector.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.name.endsWith('.fla') || file.name.endsWith('.zip') || file.name.endsWith('.xfl')) {
                    loadRealFlaFile(file);
                } else {
                    vectors = [];
                    selectedVectorIndex = -1;
                    openEditor(640, 360, file.name);
                    redrawCanvas();
                }
            }
        });
    }

    templateCards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('heading');
            vectors = [];
            selectedVectorIndex = -1;
            if (type === 'Full HD') openEditor(1920, 1080, "Full HD Workspace");
            else if (type === 'Square') openEditor(1080, 1080, "Square Workspace");
            redrawCanvas();
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
              if (file.name.endsWith('.fla')) {
                  loadRealFlaFile(file);
              } else {
                  openEditor(640, 360, file.name);
              }
            }
        });
    }
});