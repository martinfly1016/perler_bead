const canvas = document.getElementById('perlerCanvas');
const ctx = canvas.getContext('2d');
const miniMapCanvas = document.getElementById('miniMapCanvas');
const miniMapCtx = miniMapCanvas.getContext('2d');
const colorPalette = document.getElementById('colorPalette');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');

const gridSize = 30; // Number of beads in width and height (logical grid size)
const initialPixelSize = 15; // Initial logical size of each "bead" in CSS pixels
const beadRadiusFactor = 0.4; // Factor of pixelSize for bead radius (0.5 for full circle, -1 for gap)

// --- High DPI Rendering Logic ---
const devicePixelRatio = window.devicePixelRatio || 1;
const logicalCanvasWidth = gridSize * initialPixelSize;
const logicalCanvasHeight = gridSize * initialPixelSize;

canvas.style.width = `${logicalCanvasWidth}px`;
canvas.style.height = `${logicalCanvasHeight}px`;
canvas.width = logicalCanvasWidth * devicePixelRatio;
canvas.height = logicalCanvasHeight * devicePixelRatio;
ctx.scale(devicePixelRatio, devicePixelRatio);
// --- End High DPI Rendering Logic ---

// --- Mini-Map Settings ---
const miniMapSize = 150; // Mini-map canvas size (e.g., 150x150 pixels)
miniMapCanvas.width = miniMapSize * devicePixelRatio;
miniMapCanvas.height = miniMapSize * devicePixelRatio;
miniMapCanvas.style.width = `${miniMapSize}px`;
miniMapCanvas.style.height = `${miniMapSize}px`;
miniMapCtx.scale(devicePixelRatio, devicePixelRatio);
const miniMapBeadSize = miniMapSize / gridSize; // Size of a bead on the mini-map

// --- Canvas Zoom & Pan State ---
let scaleFactor = 1.0; // Current zoom level
let translateX = 0;   // Current pan offset X
let translateY = 0;   // Current pan offset Y

let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;

let selectedColor = '#FF0000'; // Default selected color (Red)
let perlerGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null)); // 2D array to store bead colors

// Define a simple palette of common perler bead colors
const colors = [
    '#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FFA500', '#800080',
    '#000000', '#FFFFFF', '#A52A2A', '#FFC0CB', '#808080', '#ADD8E6'
];

// Function to draw a single bead on a given context
function drawBead(context, x, y, color, beadPixelSize) {
    if (!color) return; // Don't draw if no color (empty bead)

    context.beginPath();
    const centerX = x * beadPixelSize + beadPixelSize / 2;
    const centerY = y * beadPixelSize + beadPixelSize / 2;
    context.arc(centerX, centerY, beadPixelSize * beadRadiusFactor, 0, Math.PI * 2, false);
    context.fillStyle = color;
    context.fill();
    context.closePath();
}

// Function to draw the main canvas grid and beads
function drawMainCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); // Save current context state

    // Apply pan and zoom transformations
    ctx.translate(translateX, translateY);
    ctx.scale(scaleFactor, scaleFactor);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, logicalCanvasWidth, logicalCanvasHeight); // Fill background

    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 0.5 / scaleFactor; // Adjust line width based on zoom to keep it visually consistent

    // Draw grid lines
    for (let i = 0; i <= gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * initialPixelSize);
        ctx.lineTo(logicalCanvasWidth, i * initialPixelSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(i * initialPixelSize, 0);
        ctx.lineTo(i * initialPixelSize, logicalCanvasHeight);
        ctx.stroke();
    }

    // Draw all placed beads
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (perlerGrid[row][col]) {
                drawBead(ctx, col, row, perlerGrid[row][col], initialPixelSize);
            }
        }
    }
    ctx.restore(); // Restore context to original state (undo transformations)
    drawMiniMap(); // Update mini-map after main canvas redraw
}

// New: Function to draw the mini-map
function drawMiniMap() {
    miniMapCtx.clearRect(0, 0, miniMapCanvas.width, miniMapCanvas.height);
    miniMapCtx.fillStyle = '#FFFFFF';
    miniMapCtx.fillRect(0, 0, miniMapSize, miniMapSize);

    // Draw the entire perler grid onto the mini-map
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            drawBead(miniMapCtx, col, row, perlerGrid[row][col], miniMapBeadSize);
        }
    }

    // Draw the "editing window" rectangle on the mini-map
    miniMapCtx.strokeStyle = '#3498db'; // Blue border for visibility
    miniMapCtx.lineWidth = 2; // Thicker border
    miniMapCtx.setLineDash([5, 5]); // Dashed line

    // Calculate the visible area in terms of the logical grid coordinates on the main canvas
    // Inverse transformation of main canvas view
    const visibleCanvasWidth = logicalCanvasWidth / scaleFactor;
    const visibleCanvasHeight = logicalCanvasHeight / scaleFactor;
    const visibleAreaX = -translateX / scaleFactor;
    const visibleAreaY = -translateY / scaleFactor;

    // Convert these logical pixel coordinates to mini-map coordinates
    const miniMapRectX = (visibleAreaX / logicalCanvasWidth) * miniMapSize;
    const miniMapRectY = (visibleAreaY / logicalCanvasHeight) * miniMapSize;
    const miniMapRectWidth = (visibleCanvasWidth / logicalCanvasWidth) * miniMapSize;
    const miniMapRectHeight = (visibleCanvasHeight / logicalCanvasHeight) * miniMapSize;

    miniMapCtx.strokeRect(
        miniMapRectX,
        miniMapRectY,
        miniMapRectWidth,
        miniMapRectHeight
    );
    miniMapCtx.setLineDash([]); // Reset line dash
}


// Initialize color palette
colors.forEach(color => {
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
    });
});

// --- Event Listeners for Main Canvas Interaction ---

// Start Panning or Placing Bead
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left mouse button
        const rect = canvas.getBoundingClientRect();
        // Get mouse position relative to the canvas's CSS size
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert mouse position to canvas's *transformed* coordinates
        const transformedMouseX = (mouseX - translateX) / scaleFactor;
        const transformedMouseY = (mouseY - translateY) / scaleFactor;

        // Calculate grid position
        const gridX = Math.floor(transformedMouseX / initialPixelSize);
        const gridY = Math.floor(transformedMouseY / initialPixelSize);

        // Check if click is within the grid boundaries
        if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
            // Place or remove bead
            if (perlerGrid[gridY][gridX] === selectedColor) {
                perlerGrid[gridY][gridX] = null; // Remove bead if same color
            } else {
                perlerGrid[gridY][gridX] = selectedColor; // Place new bead
            }
            drawMainCanvas(); // Redraw immediately after placing/removing bead
        } else {
            // If not clicking on a bead, start panning
            isPanning = true;
            canvas.classList.add('panning');
            lastPanX = e.clientX;
            lastPanY = e.clientY;
        }
    }
});

// Panning
canvas.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const dx = e.clientX - lastPanX;
    const dy = e.clientY - lastPanY;

    translateX += dx;
    translateY += dy;

    // Boundary checks for panning
    const maxTranslateX = logicalCanvasWidth * (scaleFactor - 1);
    const maxTranslateY = logicalCanvasHeight * (scaleFactor - 1);

    translateX = Math.max(Math.min(translateX, 0), -maxTranslateX);
    translateY = Math.max(Math.min(translateY, 0), -maxTranslateY);
    
    lastPanX = e.clientX;
    lastPanY = e.clientY;
    drawMainCanvas();
});

// Stop Panning
canvas.addEventListener('mouseup', () => {
    isPanning = false;
    canvas.classList.remove('panning');
});
canvas.addEventListener('mouseout', () => {
    isPanning = false; // Stop panning if mouse leaves canvas area
    canvas.classList.remove('panning');
});


// --- Event Listeners for Zoom Controls ---
zoomInBtn.addEventListener('click', () => {
    scaleFactor *= 1.2; // Zoom in by 20%
    if (scaleFactor > 5.0) scaleFactor = 5.0; // Cap max zoom
    
    // Adjust pan offsets to keep the center of the view somewhat stable
    translateX -= (logicalCanvasWidth / 2) * (1.2 - 1) * scaleFactor;
    translateY -= (logicalCanvasHeight / 2) * (1.2 - 1) * scaleFactor;

    // Reapply boundary checks after zoom and pan adjustment
    const maxTranslateX = logicalCanvasWidth * (scaleFactor - 1);
    const maxTranslateY = logicalCanvasHeight * (scaleFactor - 1);
    translateX = Math.max(Math.min(translateX, 0), -maxTranslateX);
    translateY = Math.max(Math.min(translateY, 0), -maxTranslateY);

    drawMainCanvas();
});

zoomOutBtn.addEventListener('click', () => {
    scaleFactor /= 1.2; // Zoom out by 20%
    if (scaleFactor < 1.0) scaleFactor = 1.0; // Prevent zooming out too much

    // Adjust pan offsets to keep the center of the view somewhat stable
    translateX += (logicalCanvasWidth / 2) * (1 - (1/1.2)) * scaleFactor;
    translateY += (logicalCanvasHeight / 2) * (1 - (1/1.2)) * scaleFactor;

    // If zoomed out completely, reset pan
    if (scaleFactor === 1.0) {
        translateX = 0;
        translateY = 0;
    } else {
        // Reapply boundary checks after zoom and pan adjustment
        const maxTranslateX = logicalCanvasWidth * (scaleFactor - 1);
        const maxTranslateY = logicalCanvasHeight * (scaleFactor - 1);
        translateX = Math.max(Math.min(translateX, 0), -maxTranslateX);
        translateY = Math.max(Math.min(translateY, 0), -maxTranslateY);
    }
    
    drawMainCanvas();
});


// Event Listener for clear button
clearBtn.addEventListener('click', () => {
    perlerGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
    scaleFactor = 1.0; // Reset zoom
    translateX = 0;    // Reset pan
    translateY = 0;
    drawMainCanvas();
});

// Event Listener for download button
downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'kids_perler_artwork.png';
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = logicalCanvasWidth * devicePixelRatio;
    tempCanvas.height = logicalCanvasHeight * devicePixelRatio;
    tempCtx.scale(devicePixelRatio, devicePixelRatio);

    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, logicalCanvasWidth, logicalCanvasHeight); // Fill background

    tempCtx.strokeStyle = '#E0E0E0';
    tempCtx.lineWidth = 0.5; // Use 0.5 physical pixel for subtle grid in download

    // Draw grid lines on temp canvas
    for (let i = 0; i <= gridSize; i++) {
        tempCtx.beginPath();
        tempCtx.moveTo(0, i * initialPixelSize);
        tempCtx.lineTo(logicalCanvasWidth, i * initialPixelSize);
        tempCtx.stroke();

        tempCtx.beginPath();
        tempCtx.moveTo(i * initialPixelSize, 0);
        tempCtx.lineTo(i * initialPixelSize, logicalCanvasHeight);
        tempCtx.stroke();
    }

    // Draw all placed beads on temp canvas
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (perlerGrid[row][col]) {
                drawBead(tempCtx, col, row, perlerGrid[row][col], initialPixelSize);
            }
        }
    }

    link.href = tempCanvas.toDataURL('image/png');
    link.click();
});

// Initial draw
drawMainCanvas();