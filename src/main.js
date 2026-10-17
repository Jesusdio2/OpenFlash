import '@spectrum-web-components/bundle/elements.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnCreate = document.querySelector('#btn-create');
    const btnOpen = document.querySelector('#btn-open');
    const fileSelector = document.querySelector('#file-selector');
    
    const panelHome = document.querySelector('#panel-home');
    const panelEditor = document.querySelector('#panel-editor');
    const logoHome = document.querySelector('#logo-home');
    const stage = document.querySelector('#editor-stage');
    const templateCards = document.querySelectorAll('.template-card');
    
    const timelineTitle = document.querySelector('#timeline-title');
    const layerStatus = document.querySelector('#layer-status');

    // Función para saltar al editor
    const openEditor = (width, height, title = "Untitled-1") => {
        panelHome.style.display = 'none';
        panelEditor.style.display = 'flex';
        
        if (width && height) {
            stage.style.width = `${width}px`;
            stage.style.height = `${height}px`;
        }
        
        // Colocar el nombre del archivo en la barra o en la línea de tiempo
        timelineTitle.textContent = `TIMELINE - ${title.toUpperCase()}`;
        layerStatus.textContent = `${title}`;
    };

    if (btnCreate) {
        btnCreate.addEventListener('click', () => {
            openEditor(640, 360, "New Animation");
        });
    }

    // INTERACTIVIDAD "OPEN"
    if (btnOpen && fileSelector) {
        btnOpen.addEventListener('click', () => {
            // Forzar el clic en el selector nativo del sistema
            fileSelector.click();
        });

        // Detectar cuando el usuario selecciona un archivo real de su disco duro
        fileSelector.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                console.log(`Cargando archivo en OpenFlash: ${file.name} (${file.size} bytes)`);
                // Saltamos al entorno de animación mostrando el nombre de tu archivo cargado
                openEditor(640, 360, file.name);
            }
        });
    }

    templateCards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('heading');
            if (type === 'Full HD') {
                openEditor(800, 450, "Full HD Workspace");
            } else if (type === 'Square') {
                openEditor(400, 400, "Square Workspace");
            }
        });
    });

    if (logoHome) {
        logoHome.addEventListener('click', () => {
            panelEditor.style.display = 'none';
            panelHome.style.display = 'flex';
            // Resetear el selector de archivos
            fileSelector.value = '';
        });
    }

    // Soporte para File Handling API (PWA abrir archivos externos)
    if ('launchQueue' in window && 'files' in LaunchParams.prototype) {
        window.launchQueue.setConsumer(async (launchParams) => {
            if (!launchParams.files.length) return;

            for (const fileHandle of launchParams.files) {
              const file = await fileHandle.getFile();
            console.log(`Archivo abierto desde el sistema: ${file.name}`);
            
            // Llamamos a tu función para abrir el editor con el archivo cargado
            openEditor(640, 360, file.name);
            }
        });
    }
});
