const canvas = document.getElementById('perlerCanvas');
const ctx = canvas.getContext('2d');
const miniMapCanvas = document.getElementById('miniMapCanvas');
const miniMapCtx = miniMapCanvas.getContext('2d');
const colorPalette = document.getElementById('colorPalette');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');

// --- Core Configuration ---
const initialBeadPixelSize = 30; // Larger default bead size as requested
const beadRadiusFactor = 0.4;    // Factor of pixelSize for bead radius (0.5 for full circle, -1 for gap)
const minScaleFactor = 0.5;      // Allow zooming out slightly to see more
const maxScaleFactor = 10.0;     // Allow more zoom in
// const gridSize = 30; // REMOVED: No longer needed for infinite canvas grid drawing
// const miniMapInitialSize = 150; // REMOVED: Changed to miniMapSize and now dynamically determined by CSS and clientWidth

// --- Global State ---
let devicePixelRatio = window.devicePixelRatio || 1;
let currentBeadPixelSize = initialBeadPixelSize; // This will change with zoom
let scaleFactor = 1.0;
let translateX = 0;
let translateY = 0;

let activePointers = new Map(); // For multi-touch
let lastCenter = null;
let lastDistance = null;
let isPinching = false;
let isDragging = false; // For single-pointer pan

let tapTimer = null;
let initialPointerX = 0;
let initialPointerY = 0;
const tapThresholdPx = 5;
const longPressDelayMs = 250;
let isConsideringTap = false;

let selectedColor = '#FF0000'; // Default selected color (Red)
let perlerGrid = new Map(); // Changed to Map for \"infinite\" grid support: key \"x,y\" => color\n
// Define a simple palette of common perler bead colors
const colors = [
    '#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FFA500', '#800080',
    '#000000', '#FFFFFF', '#A52A2A', '#FFC0CB', '#808080', '#ADD8E6'
];

// REMOVED: const miniMapBeadSize = miniMapSize / gridSize; // This is no longer used and caused errors.

// --- Canvas Sizing & High DPI Handling ---
function resizeCanvas() {
    const canvasArea = canvas.parentElement;
    const cssWidth = canvasArea.clientWidth;
    const cssHeight = canvasArea.clientHeight;

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    canvas.width = cssWidth * devicePixelRatio;
    canvas.height = cssHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // After resize, redraw everything
    drawMainCanvas();
}

window.addEventListener('resize', resizeCanvas); // Listen for window resize

// --- Drawing Functions ---
function drawBead(context, x, y, color, beadPixelSizeToUse) {
    if (!color) return;

    context.beginPath();
    const centerX = x * beadPixelSizeToUse + beadPixelSizeToUse / 2;
    const centerY = y * beadPixelSizeToUse + beadPixelSizeToUse / 2;
    context.arc(centerX, centerY, beadPixelSizeToUse * beadRadiusFactor, 0, Math.PI * 2, false);
    context.fillStyle = color;
    context.fill();
    context.closePath();
}

function drawMainCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear physical canvas dimensions
    ctx.save();

    // Apply global transformations
    ctx.translate(translateX, translateY);
    ctx.scale(scaleFactor, scaleFactor);

    ctx.fillStyle = '#FFFFFF';
    // Fill the currently visible logical area
    ctx.fillRect(-translateX / scaleFactor, -translateY / scaleFactor, canvas.clientWidth / scaleFactor, canvas.clientHeight / scaleFactor);

    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 0.5 / scaleFactor; // Grid lines scale with zoom, but visually thinner when zoomed in.\n
    // Draw visible grid lines
    const minVisibleX = Math.floor(-translateX / (initialBeadPixelSize * scaleFactor));
    const maxVisibleX = Math.ceil((canvas.clientWidth / scaleFactor - translateX) / initialBeadPixelSize); // Use initialBeadPixelSize here
    const minVisibleY = Math.floor(-translateY / (initialBeadPixelSize * scaleFactor));
    const maxVisibleY = Math.ceil((canvas.clientHeight / scaleFactor - translateY) / initialBeadPixelSize); // Use initialBeadPixelSize here\n
    for (let i = minVisibleX; i <= maxVisibleX; i++) {
        ctx.beginPath();
        ctx.moveTo(i * initialBeadPixelSize, minVisibleY * initialBeadPixelSize); 
        ctx.lineTo(i * initialBeadPixelSize, maxVisibleY * initialBeadPixelSize); 
        ctx.stroke();
    }
    for (let j = minVisibleY; j <= maxVisibleY; j++) {
        ctx.beginPath();
        ctx.moveTo(minVisibleX * initialBeadPixelSize, j * initialBeadPixelSize); 
        ctx.lineTo(maxVisibleX * initialBeadPixelSize, j * initialBeadPixelSize); 
        ctx.stroke();
    }
    
    // Draw all placed beads that are currently visible\n    perlerGrid.forEach((color, key) => {
        const [x, y] = key.split(',').map(Number);
        const beadLeft = x * initialBeadPixelSize;
        const beadTop = y * initialBeadPixelSize;
        const beadRight = beadLeft + initialBeadPixelSize;
        const beadBottom = beadTop + initialBeadPixelSize;

        const viewportLeft = -translateX / scaleFactor;
        const viewportTop = -translateY / scaleFactor;
        const viewportRight = viewportLeft + canvas.clientWidth / scaleFactor;
        const viewportBottom = viewportTop + canvas.clientHeight / scaleFactor;

        if (beadRight > viewportLeft && beadLeft < viewportRight &&
            beadBottom > viewportTop && beadTop < viewportBottom) {
            drawBead(ctx, x, y, color, initialBeadPixelSize);
        }
    });

    ctx.restore();
    drawMiniMap();
}

function drawMiniMap() {
    // Set miniMapCanvas physical dimensions to match its CSS rendered size
    miniMapCanvas.width = miniMapCanvas.clientWidth * devicePixelRatio;
    miniMapCanvas.height = miniMapCanvas.clientHeight * devicePixelRatio;
    miniMapCtx.scale(devicePixelRatio, devicePixelRatio);

    const miniMapSizeCss = miniMapCanvas.clientWidth; // Get the actual CSS rendered size (either 150px or 100px)

    miniMapCtx.clearRect(0, 0, miniMapCanvas.width, miniMapCanvas.height); // Clear physical canvas dimensions
    miniMapCtx.fillStyle = '#FFFFFF';
    miniMapCtx.fillRect(0, 0, miniMapSizeCss, miniMapSizeCss); // Use CSS size for drawing context

    // Dynamically determine the bounds of all placed beads
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (perlerGrid.size > 0) {
        perlerGrid.forEach((_, key) => {
            const [x, y] = key.split(',').map(Number);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
    } else {
        minX = -5; minY = -5; maxX = 5; maxY = 5; 
    }

    minX -= 2; minY -= 2; maxX += 2; maxY += 2; 

    const worldWidth = (maxX - minX + 1) * initialBeadPixelSize;
    const worldHeight = (maxY - minY + 1) * initialBeadPixelSize;

    const miniMapScaleX = miniMapSizeCss / worldWidth; // Use CSS size for scale calculation
    const miniMapScaleY = miniMapSizeCss / worldHeight;
    const miniMapScale = Math.min(miniMapScaleX, miniMapScaleY); // Use smaller scale to fit both dimensions

    miniMapCtx.save();
    miniMapCtx.translate(
        (miniMapSizeCss - worldWidth * miniMapScale) / 2,
        (miniMapSizeCss - worldHeight * miniMapScale) / 2
    );
    miniMapCtx.scale(miniMapScale, miniMapScale);
    miniMapCtx.translate(-minX * initialBeadPixelSize, -minY * initialBeadPixelSize); 


    // Draw all beads on mini-map
    perlerGrid.forEach((color, key) => {
        const [x, y] = key.split(',').map(Number);
        drawBead(miniMapCtx, x, y, color, initialBeadPixelSize); // Use initialBeadPixelSize for beads here
    });

    // Draw the \"editing window\" rectangle on the mini-map\n    miniMapCtx.strokeStyle = '#3498db';
    miniMapCtx.lineWidth = 2 / miniMapScale; 
    miniMapCtx.setLineDash([5 / miniMapScale, 5 / miniMapScale]);

    const viewportLeft = -translateX / scaleFactor;
    const viewportTop = -translateY / scaleFactor;
    const viewportWidth = canvas.clientWidth / scaleFactor;
    const viewportHeight = canvas.clientHeight / scaleFactor;

    miniMapCtx.strokeRect(viewportLeft, viewportTop, viewportWidth, viewportHeight);
    miniMapCtx.setLineDash([]);
    miniMapCtx.restore();

    // Reset miniMapCtx scale for next draw, as we apply it again
    miniMapCtx.setTransform(1, 0, 0, 1, 0, 0); 
}

function applyPanBoundaries() {
    // With infinite canvas, boundaries are less strict. We allow panning freely.
    // However, ensure translateX and translateY don't become NaN or extremely large/small.\n}


// Initialize color palette\ncolors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;
    swatch.dataset.color = color;
    colorPalette.appendChild(swatch);

    if (color === selectedColor) {
        swatch.classList.add('selected');
    }

    swatch.addEventListener('click', () => {
        const prevSelected = document.querySelector('.color-swatch.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }
        swatch.classList.add('selected');
        selectedColor = color;
    });\n});

// --- Pointer Event Listeners for Main Canvas Interaction ---\n
canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault(); 
    canvas.setPointerCapture(e.pointerId); 

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) { 
        isConsideringTap = true;\n        isDragging = false; 
        canvas.classList.remove('panning');

        initialPointerX = e.clientX;
        initialPointerY = e.clientY;
        lastPanX = e.clientX; 
        lastPanY = e.clientY;

        tapTimer = setTimeout(() => {
            if (isConsideringTap) { 
                isConsideringTap = false; \n                isDragging = true; 
                canvas.classList.add('panning');
            }
        }, longPressDelayMs);

    } else if (activePointers.size === 2) { 
        if (tapTimer) clearTimeout(tapTimer); 
        isConsideringTap = false;\n        isDragging = false; 
        isPinching = true;\n        canvas.classList.remove('panning');

        const pointers = Array.from(activePointers.values());
        const p1 = pointers[0];
        const p2 = pointers[1];

        lastDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        
        const rect = canvas.getBoundingClientRect();
        lastCenter = {
            x: (p1.x + p2.x) / 2 - rect.left,
            y: (p1.y + p2.y) / 2 - rect.top\n        };
    }
}, { passive: false });

canvas.addEventListener('pointermove', (e) => {
    e.preventDefault(); 
    if (!activePointers.has(e.pointerId)) return;

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (isConsideringTap) { 
        const dx = e.clientX - initialPointerX;
        const dy = e.clientY - initialPointerY;
        const distance = Math.hypot(dx, dy);

        if (distance > tapThresholdPx) { 
            clearTimeout(tapTimer);
            isConsideringTap = false;\n            isDragging = true; 
            canvas.classList.add('panning');
        }
    }

    if (isPinching && activePointers.size === 2) { 
        const pointers = Array.from(activePointers.values());
        const p1 = pointers[0];
        const p2 = pointers[1];

        const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const currentCenter = { 
            x: (p1.x + p2.x) / 2 - canvas.getBoundingClientRect().left,
            y: (p1.y + p2.y) / 2 - canvas.getBoundingClientRect().top
        };

        const zoomAmount = currentDistance / lastDistance;
        const newScaleFactor = scaleFactor * zoomAmount;
        
        scaleFactor = Math.max(minScaleFactor, Math.min(newScaleFactor, maxScaleFactor));

        translateX = currentCenter.x - (currentCenter.x - translateX) * (scaleFactor / newScaleFactor);
        translateY = currentCenter.y - (currentCenter.y - translateY) * (scaleFactor / newScaleFactor);

        lastDistance = currentDistance;
        lastCenter = currentCenter;

        applyPanBoundaries();
        drawMainCanvas();

    } else if (isDragging && activePointers.size === 1 && !isPinching) { 
        const dx = e.clientX - lastPanX; 
        const dy = e.clientY - lastPanY; 

        translateX += dx;
        translateY += dy;

        lastPanX = e.clientX; 
        lastPanY = e.clientY;
        
        applyPanBoundaries();
        drawMainCanvas();
    }
}, { passive: false });

canvas.addEventListener('pointerup', (e) => {
    canvas.releasePointerCapture(e.pointerId);
    activePointers.delete(e.pointerId);

    if (tapTimer) {
        clearTimeout(tapTimer);
        if (isConsideringTap && activePointers.size === 0) { 
            const rect = canvas.getBoundingClientRect();
            const mouseX = initialPointerX - rect.left; 
            const mouseY = initialPointerY - rect.top;

            const transformedMouseX = (mouseX - translateX) / scaleFactor;
            const transformedMouseY = (mouseY - translateY) / scaleFactor;

            const gridX = Math.floor(transformedMouseX / initialBeadPixelSize);
            const gridY = Math.floor(transformedMouseY / initialBeadPixelSize);

            const key = `${gridX},${gridY}`;\n            if (perlerGrid.has(key)) {
                perlerGrid.delete(key);
            } else {
                perlerGrid.set(key, selectedColor);
            }
            drawMainCanvas();
        }
    }

    isConsideringTap = false; 
    if (activePointers.size < 2) {\n        isPinching = false;
    }
    if (activePointers.size === 0) {\n        isDragging = false;\n        canvas.classList.remove('panning');\n        lastCenter = null;\n        lastDistance = null;\n        initialPointerX = 0;
        initialPointerY = 0;
        lastPanX = 0; \n        lastPanY = 0; \n    }
});

canvas.addEventListener('pointercancel', (e) => {
    if (tapTimer) clearTimeout(tapTimer);
    isConsideringTap = false;\n
    canvas.releasePointerCapture(e.pointerId);
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {\n        isPinching = false;
    }
    if (activePointers.size === 0) {\n        isDragging = false;\n        canvas.classList.remove('panning');\n        lastCenter = null;\n        lastDistance = null;\n        initialPointerX = 0;
        initialPointerY = 0;
        lastPanX = 0; \n        lastPanY = 0; \n    }
});

// --- Touch Event Listeners for Safari/iOS compatibility (ensure passive: false) ---\ncanvas.addEventListener('touchstart', (e) => {
    if (e.target === canvas) {\n        e.preventDefault();\n    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (e.target === canvas) {\n        e.preventDefault();\n    }
}, { passive: false });

// --- Event Listeners for Zoom Buttons (still active for non-touch devices or preference) ---\nzoomInBtn.addEventListener('click', () => {
    const oldScale = scaleFactor;
    scaleFactor *= 1.2; 
    scaleFactor = Math.min(scaleFactor, maxScaleFactor);
    
    translateX -= (canvas.clientWidth / 2) * (scaleFactor / oldScale - 1);\n    translateY -= (canvas.clientHeight / 2) * (scaleFactor / oldScale - 1);\n
    applyPanBoundaries();
    drawMainCanvas();
});

zoomOutBtn.addEventListener('click', () => {
    const oldScale = scaleFactor;
    scaleFactor /= 1.2; 
    scaleFactor = Math.max(scaleFactor, minScaleFactor);

    translateX += (canvas.clientWidth / 2) * (1 - scaleFactor / oldScale);\n    translateY += (canvas.clientHeight / 2) * (1 - scaleFactor / oldScale);\n
    if (scaleFactor === 1.0) { 
        translateX = 0;\n        translateY = 0;\n    }
    
    applyPanBoundaries();
    drawMainCanvas();
});


// Event Listener for clear button\nclearBtn.addEventListener('click', () => {
    perlerGrid.clear(); 
    scaleFactor = 1.0; 
    translateX = 0;    
    translateY = 0;
    drawMainCanvas();
});

// Event Listener for download button\ndownloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'kids_perler_artwork.png';
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (perlerGrid.size > 0) {
        perlerGrid.forEach((_, key) => {
            const [x, y] = key.split(',').map(Number);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
    } else {
        minX = 0; minY = 0; maxX = 0; maxY = 0;
    }

    const exportPaddingBeads = 5; \n    minX -= exportPaddingBeads;\n    minY -= exportPaddingBeads;\n    maxX += exportPaddingBeads;\n    maxY += exportPaddingBeads;\n
    const exportWidthBeads = maxX - minX + 1;\n    const exportHeightBeads = maxY - minY + 1;\n
    const tempCanvas = document.createElement('canvas');\n    const tempCtx = tempCanvas.getContext('2d');\n    \n    const exportPixelSize = 20; \n    tempCanvas.width = exportWidthBeads * exportPixelSize * devicePixelRatio;\n    tempCanvas.height = exportHeightBeads * exportPixelSize * devicePixelRatio;
    tempCtx.scale(devicePixelRatio, devicePixelRatio);

    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width / devicePixelRatio, tempCanvas.height / devicePixelRatio); // Use logical dimensions for fillRect

    tempCtx.strokeStyle = '#E0E0E0';
    tempCtx.lineWidth = 0.5;

    for (let i = 0; i <= exportWidthBeads; i++) {\n        tempCtx.beginPath();\n        tempCtx.moveTo(i * exportPixelSize, 0);\n        tempCtx.lineTo(i * exportPixelSize, exportHeightBeads * exportPixelSize);\n        tempCtx.stroke();\n    }\n    for (let j = 0; j <= exportHeightBeads; j++) {\n        tempCtx.beginPath();\n        tempCtx.moveTo(0, j * exportPixelSize);\n        tempCtx.lineTo(exportWidthBeads * exportPixelSize, j * exportPixelSize);\n        tempCtx.stroke();\n    }\n
    perlerGrid.forEach((color, key) => {\n        const [x, y] = key.split(',').map(Number);
        drawBead(tempCtx, x - minX, y - minY, color, exportPixelSize);\n    });

    link.href = tempCanvas.toDataURL('image/png');
    link.click();\n});

// Initial setup\nresizeCanvas(); 
drawMainCanvas();