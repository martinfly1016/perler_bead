const canvas = document.getElementById('perlerCanvas');
const ctx = canvas.getContext('2d');
const colorPalette = document.getElementById('colorPalette');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');

const gridSize = 30; // Number of beads in width and height
const pixelSize = 15; // Size of each "bead" in pixels
const beadRadius = pixelSize / 2 - 1; // Radius for drawing round beads

canvas.width = gridSize * pixelSize;
canvas.height = gridSize * pixelSize;

let selectedColor = '#FF0000'; // Default selected color (Red)
let perlerGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null)); // 2D array to store bead colors

// Define a simple palette of common perler bead colors
const colors = [
    '#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FFA500', '#800080',
    '#000000', '#FFFFFF', '#A52A2A', '#FFC0CB', '#808080', '#ADD8E6'
];

// Function to draw a single bead on the canvas
function drawBead(x, y, color) {
    ctx.beginPath();
    // Center of the bead
    const centerX = x * pixelSize + pixelSize / 2;
    const centerY = y * pixelSize + pixelSize / 2;
    ctx.arc(centerX, centerY, beadRadius, 0, Math.PI * 2, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
}

// Function to draw the grid lines
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas first
    ctx.fillStyle = '#FFFFFF'; // Ensure background is white
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#E0E0E0'; // Light gray grid lines
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= gridSize; i++) {
        // Draw horizontal lines
        ctx.beginPath();
        ctx.moveTo(0, i * pixelSize);
        ctx.lineTo(canvas.width, i * pixelSize);
        ctx.stroke();

        // Draw vertical lines
        ctx.beginPath();
        ctx.moveTo(i * pixelSize, 0);
        ctx.lineTo(i * pixelSize, canvas.height);
        ctx.stroke();
    }

    // Redraw all placed beads
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (perlerGrid[row][col]) {
                drawBead(col, row, perlerGrid[row][col]);
            }
        }
    }
}

// Initialize color palette
colors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;
    swatch.dataset.color = color;
    colorPalette.appendChild(swatch);

    // Select the default color initially
    if (color === selectedColor) {
        swatch.classList.add('selected');
    }

    swatch.addEventListener('click', () => {
        // Remove selected class from previous swatch
        const prevSelected = document.querySelector('.color-swatch.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }
        // Add selected class to current swatch
        swatch.classList.add('selected');
        selectedColor = color;
    });
});

// Event Listener for placing/removing beads
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);

    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        if (perlerGrid[y][x] === selectedColor) {
            // If clicking on a bead of the same color, remove it (eraser effect)
            perlerGrid[y][x] = null;
        } else {
            // Otherwise, place a bead of the selected color
            perlerGrid[y][x] = selectedColor;
        }
        drawGrid(); // Redraw grid with updated bead
    }
});

// Event Listener for clear button
clearBtn.addEventListener('click', () => {
    perlerGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
    drawGrid(); // Redraw empty grid
});

// Event Listener for download button
downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'kids_perler_artwork.png'; // Default file name
    link.href = canvas.toDataURL('image/png'); // Get image data as PNG
    link.click();
});

// Initial draw of the grid
drawGrid();