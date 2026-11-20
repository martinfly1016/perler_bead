'use strict';

// Generic craft palette with everyday Japanese names.
// These are NOT official Perler, Hama, Artkal, Nabbi, or パーラービーズ codes.
// Brand palettes stay out until they can be copied from the manufacturers'
// own charts and cited here. Planned for a later update.
const PALETTE = [
    { name: '白', hex: '#FFFFFF' },
    { name: 'クリーム', hex: '#FFF3D0' },
    { name: '薄黄', hex: '#FFF59A' },
    { name: '黄', hex: '#FFD400' },
    { name: '金', hex: '#E6A100' },
    { name: 'オレンジ', hex: '#FF8A00' },
    { name: '薄オレンジ', hex: '#FFC078' },
    { name: '赤', hex: '#E2231A' },
    { name: '濃赤', hex: '#9E1B2E' },
    { name: 'コーラル', hex: '#FF5A5F' },
    { name: 'ピンク', hex: '#FF9BB3' },
    { name: '濃ピンク', hex: '#E83E8C' },
    { name: 'マゼンタ', hex: '#C2185B' },
    { name: 'ラベンダー', hex: '#D1B3E8' },
    { name: '紫', hex: '#7B3FA1' },
    { name: '濃紫', hex: '#4A1D6A' },
    { name: '薄青', hex: '#B3D4FF' },
    { name: '水色', hex: '#4FC3F7' },
    { name: '青', hex: '#1E56D0' },
    { name: '紺', hex: '#1A2A7A' },
    { name: 'ネイビー', hex: '#0E1A40' },
    { name: 'シアン', hex: '#00ACC1' },
    { name: '青緑', hex: '#00897B' },
    { name: 'ミント', hex: '#9BE7C4' },
    { name: '黄緑', hex: '#8FD14F' },
    { name: '緑', hex: '#2E9E44' },
    { name: '濃緑', hex: '#1B5E20' },
    { name: 'オリーブ', hex: '#7A7A2F' },
    { name: 'カーキ', hex: '#C6B15A' },
    { name: '茶', hex: '#8D5A3B' },
    { name: '濃茶', hex: '#5D3A2A' },
    { name: 'ベージュ', hex: '#E4C8A2' },
    { name: '肌色', hex: '#FFCBA8' },
    { name: '薄グレー', hex: '#E6E6E6' },
    { name: 'グレー', hex: '#9E9E9E' },
    { name: '濃グレー', hex: '#5C5C5C' },
    { name: '黒', hex: '#1A1A1A' },
    { name: '錆色', hex: '#C4511A' },
    { name: 'プラム', hex: '#8E3A59' }
];

// Large square iron-bead pegboards are commonly 29 pins on a side.
// Darker lines are a layout guide for that size, not a branded template.
const PEGBOARD = 29;
const BEAD = 30;
const BEAD_RADIUS = 0.42;
const MIN_SCALE = 0.12;
const MAX_SCALE = 10;
const HISTORY_LIMIT = 60;
const SAMPLES = {
    strawberry: 'samples/strawberry.svg',
    star: 'samples/star.svg',
    bird: 'samples/bird.svg'
};
const TOOL_HINTS = {
    pen: 'タップでビーズを置きます。同じ色をもう一度で消せます。',
    eraser: 'タップしたビーズを消します。',
    fill: 'つながった同じ色を、今の色に塗り替えます。空きマスはボードの内側だけです。',
    picker: '置いてあるビーズの色を吸い取ります。'
};

const canvas = document.getElementById('perlerCanvas');
const ctx = canvas.getContext('2d');
const miniMapCanvas = document.getElementById('miniMapCanvas');
const miniMapCtx = miniMapCanvas.getContext('2d');
const colorPalette = document.getElementById('colorPalette');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const toolPen = document.getElementById('toolPen');
const toolEraser = document.getElementById('toolEraser');
const toolFill = document.getElementById('toolFill');
const toolPicker = document.getElementById('toolPicker');
const toolPhoto = document.getElementById('toolPhoto');
const convertClose = document.getElementById('convertClose');
const toolHint = document.getElementById('toolHint');
const editorStatus = document.getElementById('editorStatus');
const currentSwatch = document.getElementById('currentSwatch');
const currentName = document.getElementById('currentName');
const countPanel = document.getElementById('countPanel');
const countToggle = document.getElementById('countToggle');
const countList = document.getElementById('countList');
const countTotal = document.getElementById('countTotal');
const countColors = document.getElementById('countColors');
const usedCount = document.getElementById('usedCount');
const boardLabel = document.getElementById('boardLabel');
const convertPanel = document.getElementById('convert');
const imageInput = document.getElementById('imageInput');
const colorCountInput = document.getElementById('colorCount');
const colorCountValue = document.getElementById('colorCountValue');
const removeBgInput = document.getElementById('removeBg');
const bgToleranceInput = document.getElementById('bgTolerance');
const bgToleranceValue = document.getElementById('bgToleranceValue');
const toleranceField = document.getElementById('toleranceField');
const stretchInput = document.getElementById('stretchFit');
const applyBtn = document.getElementById('applyConvert');
const convertStatus = document.getElementById('convertStatus');
const previewCanvas = document.getElementById('convertPreview');

const paletteLab = PALETTE.map(function (color) {
    const rgb = hexToRgb(color.hex);
    return rgbToLab(rgb[0], rgb[1], rgb[2]);
});
const nameByHex = new Map(PALETTE.map(function (color) {
    return [color.hex, color.name];
}));

let devicePixelRatio = window.devicePixelRatio || 1;
let scaleFactor = 1;
let translateX = 0;
let translateY = 0;
let miniMapSize = window.innerWidth <= 860 ? 96 : 132;
let boardSize = 29;
let selectedColor = '#E2231A';
let tool = 'pen';
let perlerGrid = new Map();
let fittedOnce = false;

const history = [new Map()];
let historyIndex = 0;

let sourceImage = null;
let previewResult = null;
let previewFrame = 0;
let colorLimitCustom = false;
let statusTimer = 0;

const activePointers = new Map();
let lastCenter = null;
let lastDistance = null;
let isPinching = false;
let isDragging = false;
let lastPanX = 0;
let lastPanY = 0;
let tapTimer = null;
let initialPointerX = 0;
let initialPointerY = 0;
const tapThresholdPx = 5;
const longPressDelayMs = 250;
let isConsideringTap = false;

const DRAW_START_STORAGE_KEY = 'bead_draw_start';

function trackEvent(name, params) {
    try {
        if (typeof gtag !== 'function') return;
        gtag('event', name, params || {});
    } catch (err) {
        // Analytics must not affect drawing, conversion, or navigation.
    }
}

function trackDrawStart(color) {
    try {
        if (sessionStorage.getItem(DRAW_START_STORAGE_KEY) === '1') return;
        sessionStorage.setItem(DRAW_START_STORAGE_KEY, '1');
    } catch (err) {
        if (trackDrawStart.fired) return;
        trackDrawStart.fired = true;
    }
    trackEvent('bead_draw_start', { bead_color: color });
}

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16)
    ];
}

function srgbChannelToLinear(channel) {
    const value = channel / 255;
    if (value <= 0.04045) return value / 12.92;
    return Math.pow((value + 0.055) / 1.055, 2.4);
}

function rgbToLab(r, g, b) {
    const R = srgbChannelToLinear(r);
    const G = srgbChannelToLinear(g);
    const B = srgbChannelToLinear(b);
    const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
    const y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750);
    const z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
    const f = function (t) {
        return t > 0.008856 ? Math.cbrt(t) : (7.787037 * t) + (16 / 116);
    };
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function dist2(a, b) {
    const dl = a[0] - b[0];
    const da = a[1] - b[1];
    const db = a[2] - b[2];
    return dl * dl + da * da + db * db;
}

function nearestIndex(r, g, b) {
    const lab = rgbToLab(r, g, b);
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < paletteLab.length; i++) {
        const distance = dist2(lab, paletteLab[i]);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = i;
        }
    }
    return best;
}

function colorName(hex) {
    return nameByHex.get(hex) || hex;
}

function boardCaption(size) {
    if (size === 15 || size === 20) return '小さめ ' + size + '×' + size;
    if (size === 29) return '標準の四角ボード 29×29';
    if (size === 58) return '四角ボードを2×2に並べた58×58';
    return size + '×' + size;
}

function boardMeta(size) {
    if (size === 15 || size === 20) return size + '×' + size + '（小さめ）';
    if (size === 29) return '29×29（標準の四角ボード）';
    if (size === 58) return '58×58（ボード2×2）';
    return size + '×' + size;
}

function paintBoardLabel() {
    boardLabel.textContent = boardMeta(boardSize);
    boardLabel.title = boardCaption(boardSize);
}

function sameGrid(a, b) {
    if (a.size !== b.size) return false;
    let same = true;
    a.forEach(function (color, key) {
        if (b.get(key) !== color) same = false;
    });
    return same;
}

function commit() {
    const snap = new Map(perlerGrid);
    if (historyIndex >= 0 && sameGrid(history[historyIndex], snap)) {
        refreshCounts();
        refreshHistoryButtons();
        return;
    }
    history.splice(historyIndex + 1);
    history.push(snap);
    if (history.length > HISTORY_LIMIT) {
        history.splice(0, history.length - HISTORY_LIMIT);
    }
    historyIndex = history.length - 1;
    refreshCounts();
    refreshHistoryButtons();
}

function refreshHistoryButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
}

function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    perlerGrid = new Map(history[historyIndex]);
    refreshCounts();
    refreshHistoryButtons();
    drawMainCanvas();
    trackEvent('undo', { bead_count: perlerGrid.size });
}

function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    perlerGrid = new Map(history[historyIndex]);
    refreshCounts();
    refreshHistoryButtons();
    drawMainCanvas();
}

function flashStatus(text) {
    editorStatus.textContent = text;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(function () {
        editorStatus.textContent = '';
    }, 3600);
}

function selectColor(hex) {
    const changed = selectedColor !== hex;
    selectedColor = hex;
    const swatches = colorPalette.querySelectorAll('.color-swatch');
    swatches.forEach(function (swatch) {
        const on = swatch.dataset.color === hex;
        swatch.classList.toggle('selected', on);
        swatch.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    currentSwatch.style.background = hex;
    currentName.textContent = colorName(hex);
    if (changed) trackEvent('bead_color_change', { bead_color: hex });
}

function buildPalette() {
    PALETTE.forEach(function (color) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'color-swatch';
        button.style.backgroundColor = color.hex;
        button.dataset.color = color.hex;
        button.title = color.name;
        button.setAttribute('aria-label', color.name);
        button.setAttribute('aria-pressed', color.hex === selectedColor ? 'true' : 'false');
        if (color.hex === selectedColor) button.classList.add('selected');
        button.addEventListener('click', function () {
            selectColor(color.hex);
        });
        colorPalette.appendChild(button);
    });
    currentSwatch.style.background = selectedColor;
    currentName.textContent = colorName(selectedColor);
    colorCountInput.max = String(PALETTE.length);
}

function refreshCounts() {
    const counts = new Map();
    perlerGrid.forEach(function (hex) {
        counts.set(hex, (counts.get(hex) || 0) + 1);
    });
    const rows = Array.from(counts.entries()).sort(function (a, b) {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0] < b[0] ? -1 : 1;
    });
    countList.replaceChildren();
    rows.forEach(function (row) {
        const hex = row[0];
        const count = row[1];
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'count-row';
        button.dataset.color = hex;
        button.dataset.count = String(count);
        const swatch = document.createElement('span');
        swatch.className = 'count-swatch';
        swatch.style.background = hex;
        const name = document.createElement('span');
        name.className = 'count-name';
        name.textContent = colorName(hex);
        const num = document.createElement('span');
        num.className = 'count-num';
        num.textContent = String(count);
        button.append(swatch, name, num);
        button.addEventListener('click', function () {
            selectColor(hex);
        });
        li.appendChild(button);
        countList.appendChild(li);
    });
    if (rows.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'count-empty';
        empty.textContent = 'まだありません';
        countList.appendChild(empty);
    }
    countList.dataset.colors = String(rows.length);
    countTotal.textContent = String(perlerGrid.size);
    countTotal.dataset.total = String(perlerGrid.size);
    if (countColors) countColors.textContent = rows.length + '色';
    if (usedCount) usedCount.textContent = rows.length + '色';
    const used = new Set(rows.map(function (row) { return row[0]; }));
    colorPalette.querySelectorAll('.color-swatch').forEach(function (swatch) {
        swatch.classList.toggle('is-used', used.has(swatch.dataset.color));
    });
    paintBoardLabel();
}

function setPressed(selector, activeValue, datasetKey) {
    document.querySelectorAll(selector).forEach(function (button) {
        const on = Number(button.dataset[datasetKey]) === activeValue;
        button.classList.toggle('is-active', on);
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}

function setBoard(size, options) {
    const opts = options || {};
    boardSize = size;
    canvas.dataset.boardSize = String(size);
    setPressed('[data-board]', size, 'board');
    paintBoardLabel();
    if (opts.fit) fitBoard();
    if (opts.draw !== false) drawMainCanvas();
}

function suggestedColorLimit(size) {
    if (size <= 15) return 8;
    if (size <= 20) return 10;
    if (size <= 29) return 12;
    return 18;
}

function setTargetSize(size) {
    setPressed('[data-target-size]', size, 'targetSize');
    if (!colorLimitCustom) {
        const suggested = Math.min(suggestedColorLimit(size), PALETTE.length);
        colorCountInput.value = String(suggested);
        colorCountValue.textContent = colorCountInput.value;
    }
    schedulePreview();
}

function setTool(next) {
    tool = next;
    const buttons = [
        [toolPen, 'pen'],
        [toolEraser, 'eraser'],
        [toolFill, 'fill'],
        [toolPicker, 'picker']
    ];
    buttons.forEach(function (pair) {
        if (!pair[0]) return;
        const on = pair[1] === next;
        pair[0].classList.toggle('is-active', on);
        pair[0].setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    canvas.dataset.tool = next;
    toolHint.textContent = TOOL_HINTS[next] || '';
    const activeButton = buttons.filter(function (pair) { return pair[1] === next && pair[0]; })[0];
    if (activeButton) revealTool(activeButton[0]);
}

function revealTool(button) {
    const bar = button.closest('.tools');
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    if (rect.left < barRect.left - 1) bar.scrollLeft -= (barRect.left - rect.left) + 8;
    else if (rect.right > barRect.right + 1) bar.scrollLeft += (rect.right - barRect.right) + 8;
    if (rect.top < barRect.top - 1) bar.scrollTop -= (barRect.top - rect.top) + 8;
    else if (rect.bottom > barRect.bottom + 1) bar.scrollTop += (rect.bottom - barRect.bottom) + 8;
}

function setCountOpen(open) {
    countPanel.classList.toggle('is-collapsed', !open);
    countToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function cellInBoard(x, y) {
    return x >= 0 && y >= 0 && x < boardSize && y < boardSize;
}

function floodFill(startX, startY, newColor) {
    const keyOf = function (x, y) { return x + ',' + y; };
    const startKey = keyOf(startX, startY);
    const target = perlerGrid.has(startKey) ? perlerGrid.get(startKey) : null;
    if (target === newColor) return 0;
    const fillEmpty = target === null;
    if (fillEmpty && !cellInBoard(startX, startY)) {
        flashStatus('空きマスの塗りつぶしは、表示中のボードの内側だけです。');
        return 0;
    }
    const stack = [[startX, startY]];
    const seen = new Set([startKey]);
    let changed = 0;
    const limit = fillEmpty ? boardSize * boardSize : 50000;
    while (stack.length) {
        const point = stack.pop();
        const x = point[0];
        const y = point[1];
        if (fillEmpty && !cellInBoard(x, y)) continue;
        const key = keyOf(x, y);
        const current = perlerGrid.has(key) ? perlerGrid.get(key) : null;
        if (current !== target) continue;
        perlerGrid.set(key, newColor);
        changed += 1;
        if (changed >= limit) break;
        const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (let i = 0; i < neighbors.length; i++) {
            const nx = neighbors[i][0];
            const ny = neighbors[i][1];
            const neighborKey = keyOf(nx, ny);
            if (seen.has(neighborKey)) continue;
            seen.add(neighborKey);
            stack.push(neighbors[i]);
        }
    }
    return changed;
}

function applyTool(gridX, gridY) {
    if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) return;
    const key = gridX + ',' + gridY;
    if (tool === 'picker') {
        const picked = perlerGrid.get(key);
        if (!picked) {
            flashStatus('そこにはビーズがありません。');
            return;
        }
        selectColor(picked);
        setTool('pen');
        return;
    }
    if (tool === 'fill') {
        const filled = floodFill(gridX, gridY, selectedColor);
        if (!filled) return;
        commit();
        drawMainCanvas();
        trackEvent('fill', {
            bead_color: selectedColor,
            filled_cells: filled,
            bead_count: perlerGrid.size
        });
        return;
    }
    if (tool === 'eraser') {
        if (!perlerGrid.has(key)) return;
        perlerGrid.delete(key);
        commit();
        drawMainCanvas();
        return;
    }
    if (perlerGrid.get(key) === selectedColor) {
        perlerGrid.delete(key);
    } else {
        perlerGrid.set(key, selectedColor);
        trackDrawStart(selectedColor);
    }
    commit();
    drawMainCanvas();
}

function drawBead(context, x, y, color, beadPixelSize) {
    if (!color) return;
    const centerX = x * beadPixelSize + beadPixelSize / 2;
    const centerY = y * beadPixelSize + beadPixelSize / 2;
    const radius = beadPixelSize * BEAD_RADIUS;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.lineWidth = Math.max(0.6, beadPixelSize * 0.04);
    context.strokeStyle = 'rgba(74, 58, 68, 0.28)';
    context.stroke();
    const hole = beadPixelSize * 0.13;
    if (hole >= 0.8) {
        context.beginPath();
        context.arc(centerX, centerY, hole, 0, Math.PI * 2);
        context.fillStyle = '#fff';
        context.fill();
    }
}

function fitBoard() {
    const margin = 28;
    const world = boardSize * BEAD;
    const availW = Math.max(1, canvas.clientWidth - margin);
    const availH = Math.max(1, canvas.clientHeight - margin);
    let next = Math.min(availW / world, availH / world);
    next = Math.max(MIN_SCALE, Math.min(next, 2));
    scaleFactor = next;
    translateX = (canvas.clientWidth - world * scaleFactor) / 2;
    translateY = (canvas.clientHeight - world * scaleFactor) / 2;
}

function zoomAt(cx, cy, factor) {
    const oldScale = scaleFactor;
    let next = oldScale * factor;
    next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    if (Math.abs(next - oldScale) < 1e-6) return;
    const applied = next / oldScale;
    scaleFactor = next;
    translateX = cx - (cx - translateX) * applied;
    translateY = cy - (cy - translateY) * applied;
    drawMainCanvas();
}

function resizeCanvas() {
    devicePixelRatio = window.devicePixelRatio || 1;
    const area = canvas.parentElement;
    const cssWidth = area.clientWidth;
    const cssHeight = area.clientHeight;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = Math.max(1, Math.round(cssWidth * devicePixelRatio));
    canvas.height = Math.max(1, Math.round(cssHeight * devicePixelRatio));
    miniMapSize = window.innerWidth <= 860 ? 96 : 132;
    miniMapCanvas.style.width = miniMapSize + 'px';
    miniMapCanvas.style.height = miniMapSize + 'px';
    if (!fittedOnce && cssWidth > 0 && cssHeight > 0) {
        fitBoard();
        fittedOnce = true;
    }
    drawMainCanvas();
}

function drawMainCanvas() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    const left = -translateX / scaleFactor;
    const top = -translateY / scaleFactor;
    const right = left + canvas.clientWidth / scaleFactor;
    const bottom = top + canvas.clientHeight / scaleFactor;
    const minCol = Math.floor(left / BEAD) - 2;
    const maxCol = Math.ceil(right / BEAD) + 2;
    const minRow = Math.floor(top / BEAD) - 2;
    const maxRow = Math.ceil(bottom / BEAD) + 2;

    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.save();
    ctx.translate(translateX, translateY);
    ctx.scale(scaleFactor, scaleFactor);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
    ctx.fillStyle = 'rgba(229, 119, 159, 0.05)';
    ctx.fillRect(0, 0, boardSize * BEAD, boardSize * BEAD);

    if ((maxCol - minCol) < 2500 && (maxRow - minRow) < 2500) {
        ctx.beginPath();
        ctx.strokeStyle = '#EFE7EC';
        ctx.lineWidth = 1 / scaleFactor;
        for (let x = minCol; x <= maxCol; x++) {
            ctx.moveTo(x * BEAD, minRow * BEAD);
            ctx.lineTo(x * BEAD, maxRow * BEAD);
        }
        for (let y = minRow; y <= maxRow; y++) {
            ctx.moveTo(minCol * BEAD, y * BEAD);
            ctx.lineTo(maxCol * BEAD, y * BEAD);
        }
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.strokeStyle = '#E7A8C2';
    ctx.lineWidth = 1.75 / scaleFactor;
    const firstCol = Math.ceil(minCol / PEGBOARD) * PEGBOARD;
    const firstRow = Math.ceil(minRow / PEGBOARD) * PEGBOARD;
    for (let x = firstCol; x <= maxCol; x += PEGBOARD) {
        ctx.moveTo(x * BEAD, minRow * BEAD);
        ctx.lineTo(x * BEAD, maxRow * BEAD);
    }
    for (let y = firstRow; y <= maxRow; y += PEGBOARD) {
        ctx.moveTo(minCol * BEAD, y * BEAD);
        ctx.lineTo(maxCol * BEAD, y * BEAD);
    }
    ctx.stroke();

    ctx.strokeStyle = '#E5779F';
    ctx.lineWidth = 2.5 / scaleFactor;
    ctx.strokeRect(0, 0, boardSize * BEAD, boardSize * BEAD);

    perlerGrid.forEach(function (color, key) {
        const parts = key.split(',');
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        const x0 = x * BEAD;
        const y0 = y * BEAD;
        if (x0 + BEAD < left || x0 > right || y0 + BEAD < top || y0 > bottom) return;
        drawBead(ctx, x, y, color, BEAD);
    });

    ctx.restore();
    if (shouldShowMiniMap()) {
        miniMapCanvas.style.visibility = 'visible';
        drawMiniMap();
    } else {
        miniMapCanvas.style.visibility = 'hidden';
    }
}

function shouldShowMiniMap() {
    const viewLeft = -translateX / scaleFactor;
    const viewTop = -translateY / scaleFactor;
    const viewRight = viewLeft + canvas.clientWidth / scaleFactor;
    const viewBottom = viewTop + canvas.clientHeight / scaleFactor;
    const world = boardSize * BEAD;
    if (viewLeft > 1 || viewTop > 1 || viewRight < world - 1 || viewBottom < world - 1) return true;
    let outside = false;
    perlerGrid.forEach(function (color, key) {
        if (outside) return;
        const parts = key.split(',');
        const x = Number(parts[0]) * BEAD;
        const y = Number(parts[1]) * BEAD;
        if (x + BEAD < viewLeft || x > viewRight || y + BEAD < viewTop || y > viewBottom) outside = true;
    });
    return outside;
}

function miniMapBounds() {
    let minX = 0;
    let minY = 0;
    let maxX = boardSize - 1;
    let maxY = boardSize - 1;
    perlerGrid.forEach(function (color, key) {
        const parts = key.split(',');
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    });
    if (maxX - minX > 180) {
        minX = 0;
        maxX = boardSize - 1;
    }
    if (maxY - minY > 180) {
        minY = 0;
        maxY = boardSize - 1;
    }
    return { minX: minX - 1, minY: minY - 1, maxX: maxX + 1, maxY: maxY + 1 };
}

function drawMiniMap() {
    const dpr = devicePixelRatio;
    miniMapCanvas.width = Math.max(1, Math.round(miniMapSize * dpr));
    miniMapCanvas.height = Math.max(1, Math.round(miniMapSize * dpr));
    miniMapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    miniMapCtx.clearRect(0, 0, miniMapSize, miniMapSize);
    miniMapCtx.fillStyle = '#ffffff';
    miniMapCtx.fillRect(0, 0, miniMapSize, miniMapSize);

    const bounds = miniMapBounds();
    const worldW = (bounds.maxX - bounds.minX + 1) * BEAD;
    const worldH = (bounds.maxY - bounds.minY + 1) * BEAD;
    const mapScale = Math.min(miniMapSize / worldW, miniMapSize / worldH);
    const offsetX = (miniMapSize - worldW * mapScale) / 2;
    const offsetY = (miniMapSize - worldH * mapScale) / 2;

    miniMapCtx.save();
    miniMapCtx.translate(offsetX, offsetY);
    miniMapCtx.scale(mapScale, mapScale);
    miniMapCtx.translate(-bounds.minX * BEAD, -bounds.minY * BEAD);

    miniMapCtx.fillStyle = 'rgba(229, 119, 159, 0.08)';
    miniMapCtx.fillRect(0, 0, boardSize * BEAD, boardSize * BEAD);
    miniMapCtx.strokeStyle = '#E5779F';
    miniMapCtx.lineWidth = 2 / mapScale;
    miniMapCtx.strokeRect(0, 0, boardSize * BEAD, boardSize * BEAD);

    perlerGrid.forEach(function (color, key) {
        const parts = key.split(',');
        drawBead(miniMapCtx, Number(parts[0]), Number(parts[1]), color, BEAD);
    });

    miniMapCtx.strokeStyle = '#D8628C';
    miniMapCtx.lineWidth = 2 / mapScale;
    miniMapCtx.setLineDash([6 / mapScale, 4 / mapScale]);
    const viewLeft = -translateX / scaleFactor;
    const viewTop = -translateY / scaleFactor;
    miniMapCtx.strokeRect(
        viewLeft,
        viewTop,
        canvas.clientWidth / scaleFactor,
        canvas.clientHeight / scaleFactor
    );
    miniMapCtx.restore();
}

function capturePointer(event) {
    try {
        canvas.setPointerCapture(event.pointerId);
    } catch (err) {
        // The pointer can already be gone on some browsers.
    }
}

function releasePointer(event) {
    try {
        canvas.releasePointerCapture(event.pointerId);
    } catch (err) {
        // Already released.
    }
}

function onPointerDown(event) {
    event.preventDefault();
    capturePointer(event);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size === 1) {
        isConsideringTap = true;
        isDragging = false;
        canvas.classList.remove('panning');
        initialPointerX = event.clientX;
        initialPointerY = event.clientY;
        lastPanX = event.clientX;
        lastPanY = event.clientY;
        tapTimer = window.setTimeout(function () {
            if (!isConsideringTap) return;
            isConsideringTap = false;
            isDragging = true;
            canvas.classList.add('panning');
        }, longPressDelayMs);
        return;
    }

    if (activePointers.size === 2) {
        if (tapTimer) window.clearTimeout(tapTimer);
        isConsideringTap = false;
        isDragging = false;
        isPinching = true;
        canvas.classList.remove('panning');
        const pointers = Array.from(activePointers.values());
        const p1 = pointers[0];
        const p2 = pointers[1];
        lastDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const rect = canvas.getBoundingClientRect();
        lastCenter = {
            x: (p1.x + p2.x) / 2 - rect.left,
            y: (p1.y + p2.y) / 2 - rect.top
        };
    }
}

function onPointerMove(event) {
    event.preventDefault();
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (isConsideringTap) {
        const distance = Math.hypot(event.clientX - initialPointerX, event.clientY - initialPointerY);
        if (distance > tapThresholdPx) {
            window.clearTimeout(tapTimer);
            isConsideringTap = false;
            isDragging = true;
            canvas.classList.add('panning');
        }
    }

    if (isPinching && activePointers.size === 2) {
        const pointers = Array.from(activePointers.values());
        const p1 = pointers[0];
        const p2 = pointers[1];
        const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const rect = canvas.getBoundingClientRect();
        const currentCenter = {
            x: (p1.x + p2.x) / 2 - rect.left,
            y: (p1.y + p2.y) / 2 - rect.top
        };
        if (lastDistance > 0 && currentDistance > 0) {
            zoomAt(currentCenter.x, currentCenter.y, currentDistance / lastDistance);
        }
        lastDistance = currentDistance;
        lastCenter = currentCenter;
        return;
    }

    if (isDragging && activePointers.size === 1 && !isPinching) {
        translateX += event.clientX - lastPanX;
        translateY += event.clientY - lastPanY;
        lastPanX = event.clientX;
        lastPanY = event.clientY;
        drawMainCanvas();
    }
}

function onPointerUp(event) {
    releasePointer(event);
    activePointers.delete(event.pointerId);
    if (tapTimer) {
        window.clearTimeout(tapTimer);
        if (isConsideringTap && activePointers.size === 0) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = initialPointerX - rect.left;
            const mouseY = initialPointerY - rect.top;
            const worldX = (mouseX - translateX) / scaleFactor;
            const worldY = (mouseY - translateY) / scaleFactor;
            applyTool(Math.floor(worldX / BEAD), Math.floor(worldY / BEAD));
        }
    }
    isConsideringTap = false;
    if (activePointers.size < 2) isPinching = false;
    if (activePointers.size === 0) {
        isDragging = false;
        canvas.classList.remove('panning');
        lastCenter = null;
        lastDistance = null;
    }
}

function onPointerCancel(event) {
    if (tapTimer) window.clearTimeout(tapTimer);
    isConsideringTap = false;
    releasePointer(event);
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) isPinching = false;
    if (activePointers.size === 0) {
        isDragging = false;
        canvas.classList.remove('panning');
        lastCenter = null;
        lastDistance = null;
    }
}

function exportRect() {
    if (perlerGrid.size === 0) {
        return { minX: 0, minY: 0, maxX: boardSize - 1, maxY: boardSize - 1 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    perlerGrid.forEach(function (color, key) {
        const parts = key.split(',');
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    });
    const unionMinX = Math.min(minX, 0);
    const unionMinY = Math.min(minY, 0);
    const unionMaxX = Math.max(maxX, boardSize - 1);
    const unionMaxY = Math.max(maxY, boardSize - 1);
    if (unionMaxX - unionMinX <= 119 && unionMaxY - unionMinY <= 119) {
        return { minX: unionMinX, minY: unionMinY, maxX: unionMaxX, maxY: unionMaxY };
    }
    if (maxX - minX <= 119 && maxY - minY <= 119) {
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }
    return {
        minX: minX,
        minY: minY,
        maxX: Math.min(maxX, minX + 119),
        maxY: Math.min(maxY, minY + 119)
    };
}

function downloadPattern() {
    const rect = exportRect();
    const cols = rect.maxX - rect.minX + 1;
    const rows = rect.maxY - rect.minY + 1;
    const cell = 18;
    const exportScale = 2;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = cols * cell * exportScale;
    exportCanvas.height = rows * cell * exportScale;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.setTransform(exportScale, 0, 0, exportScale, 0, 0);
    exportCtx.fillStyle = '#ffffff';
    exportCtx.fillRect(0, 0, cols * cell, rows * cell);

    exportCtx.beginPath();
    exportCtx.strokeStyle = '#E0E0E0';
    exportCtx.lineWidth = 1;
    for (let i = 0; i <= cols; i++) {
        exportCtx.moveTo(i * cell + 0.5, 0);
        exportCtx.lineTo(i * cell + 0.5, rows * cell);
    }
    for (let j = 0; j <= rows; j++) {
        exportCtx.moveTo(0, j * cell + 0.5);
        exportCtx.lineTo(cols * cell, j * cell + 0.5);
    }
    exportCtx.stroke();

    perlerGrid.forEach(function (color, key) {
        const parts = key.split(',');
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        if (x < rect.minX || y < rect.minY || x > rect.maxX || y > rect.maxY) return;
        drawBead(exportCtx, x - rect.minX, y - rect.minY, color, cell);
    });

    exportCtx.beginPath();
    exportCtx.strokeStyle = '#E7A8C2';
    exportCtx.lineWidth = 2.5;
    for (let i = 0; i <= cols; i++) {
        if ((rect.minX + i) % PEGBOARD !== 0) continue;
        exportCtx.moveTo(i * cell + 0.5, 0);
        exportCtx.lineTo(i * cell + 0.5, rows * cell);
    }
    for (let j = 0; j <= rows; j++) {
        if ((rect.minY + j) % PEGBOARD !== 0) continue;
        exportCtx.moveTo(0, j * cell + 0.5);
        exportCtx.lineTo(cols * cell, j * cell + 0.5);
    }
    exportCtx.stroke();

    exportCtx.strokeStyle = '#E5779F';
    exportCtx.lineWidth = 3;
    exportCtx.strokeRect(1.5, 1.5, cols * cell - 3, rows * cell - 3);

    const link = document.createElement('a');
    link.download = 'iron-bead-zuan-' + cols + 'x' + rows + '.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    trackEvent('bead_download', { bead_count: perlerGrid.size });
    trackEvent('export', { bead_count: perlerGrid.size, format: 'png' });
}

function clearPattern() {
    const beadCount = perlerGrid.size;
    perlerGrid.clear();
    commit();
    fitBoard();
    drawMainCanvas();
    if (beadCount > 0) flashStatus('消しました。戻すで元に戻せます。');
    trackEvent('bead_clear', { bead_count: beadCount });
}

function imageSize(image) {
    return {
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height
    };
}

function rasterize(image, maxSize) {
    const size = imageSize(image);
    if (!size.width || !size.height) throw new Error('empty image');
    const scale = Math.min(1, maxSize / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));
    const work = document.createElement('canvas');
    work.width = width;
    work.height = height;
    const workCtx = work.getContext('2d', { willReadFrequently: true });
    workCtx.clearRect(0, 0, width, height);
    workCtx.imageSmoothingEnabled = true;
    workCtx.imageSmoothingQuality = 'high';
    workCtx.drawImage(image, 0, 0, width, height);
    return workCtx.getImageData(0, 0, width, height);
}

function cornerLab(data, width, height) {
    const labs = [];
    const sample = function (x0, y0) {
        for (let y = y0; y < y0 + 8 && y < height; y++) {
            for (let x = x0; x < x0 + 8 && x < width; x++) {
                if (x < 0 || y < 0) continue;
                const i = (y * width + x) * 4;
                if (data[i + 3] < 128) continue;
                labs.push(rgbToLab(data[i], data[i + 1], data[i + 2]));
            }
        }
    };
    sample(0, 0);
    sample(width - 8, 0);
    sample(0, height - 8);
    sample(width - 8, height - 8);
    if (labs.length < 12) return null;
    let L = 0;
    let A = 0;
    let B = 0;
    for (let i = 0; i < labs.length; i++) {
        L += labs[i][0];
        A += labs[i][1];
        B += labs[i][2];
    }
    return [L / labs.length, A / labs.length, B / labs.length];
}

function maskBackground(imageData, removeBg, tolerance) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const count = width * height;
    const like = new Uint8Array(count);
    const bg = removeBg ? cornerLab(data, width, height) : null;
    const tol2 = tolerance * tolerance;
    for (let p = 0; p < count; p++) {
        const i = p * 4;
        if (data[i + 3] < 128) {
            like[p] = 1;
            continue;
        }
        if (!bg) continue;
        const lab = rgbToLab(data[i], data[i + 1], data[i + 2]);
        if (dist2(lab, bg) <= tol2) like[p] = 1;
    }
    const empty = new Uint8Array(count);
    const stack = [];
    const pushIf = function (p) {
        if (p < 0 || p >= count || empty[p] || !like[p]) return;
        empty[p] = 1;
        stack.push(p);
    };
    for (let x = 0; x < width; x++) {
        pushIf(x);
        pushIf((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
        pushIf(y * width);
        pushIf(y * width + (width - 1));
    }
    while (stack.length) {
        const p = stack.pop();
        const x = p % width;
        const y = (p - x) / width;
        if (x > 0) pushIf(p - 1);
        if (x + 1 < width) pushIf(p + 1);
        if (y > 0) pushIf(p - width);
        if (y + 1 < height) pushIf(p + width);
    }
    const fringe = [];
    for (let p = 0; p < count; p++) {
        if (empty[p]) {
            data[p * 4 + 3] = 0;
            continue;
        }
        if (data[p * 4 + 3] >= 230) continue;
        const x = p % width;
        const y = (p - x) / width;
        const touchesEmpty = (x > 0 && empty[p - 1]) ||
            (x + 1 < width && empty[p + 1]) ||
            (y > 0 && empty[p - width]) ||
            (y + 1 < height && empty[p + width]);
        if (touchesEmpty) fringe.push(p);
    }
    for (let i = 0; i < fringe.length; i++) data[fringe[i] * 4 + 3] = 0;
    return imageData;
}

function currentColorLimit() {
    const raw = Number(colorCountInput.value);
    if (!Number.isFinite(raw)) return 12;
    return Math.max(2, Math.min(PALETTE.length, Math.round(raw)));
}

function currentTolerance() {
    const raw = Number(bgToleranceInput.value);
    if (!Number.isFinite(raw)) return 18;
    return Math.max(1, Math.min(80, raw));
}

function currentTargetSize() {
    const active = document.querySelector('[data-target-size].is-active');
    const size = active ? Number(active.dataset.targetSize) : 29;
    return size || 29;
}

function sampleToGrid(imageData, size, stretch) {
    const srcW = imageData.width;
    const srcH = imageData.height;
    const data = imageData.data;
    const cells = new Int16Array(size * size);
    cells.fill(-1);
    let fitW = size;
    let fitH = size;
    let offX = 0;
    let offY = 0;
    if (!stretch) {
        const scale = Math.min(size / srcW, size / srcH);
        fitW = Math.max(1, Math.min(size, Math.round(srcW * scale)));
        fitH = Math.max(1, Math.min(size, Math.round(srcH * scale)));
        offX = Math.floor((size - fitW) / 2);
        offY = Math.floor((size - fitH) / 2);
    }
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let localX;
            let localY;
            let spanW;
            let spanH;
            if (stretch) {
                localX = x;
                localY = y;
                spanW = size;
                spanH = size;
            } else {
                localX = x - offX;
                localY = y - offY;
                if (localX < 0 || localY < 0 || localX >= fitW || localY >= fitH) continue;
                spanW = fitW;
                spanH = fitH;
            }
            const x0 = Math.min(srcW - 1, Math.floor(localX * srcW / spanW));
            const x1 = Math.min(srcW, Math.max(x0 + 1, Math.floor((localX + 1) * srcW / spanW)));
            const y0 = Math.min(srcH - 1, Math.floor(localY * srcH / spanH));
            const y1 = Math.min(srcH, Math.max(y0 + 1, Math.floor((localY + 1) * srcH / spanH)));
            let r = 0;
            let g = 0;
            let b = 0;
            let alphaSum = 0;
            let opaque = 0;
            let area = 0;
            for (let yy = y0; yy < y1; yy++) {
                for (let xx = x0; xx < x1; xx++) {
                    const i = (yy * srcW + xx) * 4;
                    const alpha = data[i + 3];
                    area += 1;
                    if (alpha < 128) continue;
                    r += data[i] * alpha;
                    g += data[i + 1] * alpha;
                    b += data[i + 2] * alpha;
                    alphaSum += alpha;
                    opaque += 1;
                }
            }
            if (!area || alphaSum === 0 || opaque / area < 0.35) continue;
            cells[y * size + x] = nearestIndex(r / alphaSum, g / alphaSum, b / alphaSum);
        }
    }
    return cells;
}

function reduceToMaxColors(cells, maxColors) {
    const counts = new Map();
    for (let i = 0; i < cells.length; i++) {
        if (cells[i] < 0) continue;
        counts.set(cells[i], (counts.get(cells[i]) || 0) + 1);
    }
    while (counts.size > maxColors) {
        const ids = Array.from(counts.keys());
        if (ids.length < 2) break;
        let bestA = ids[0];
        let bestB = ids[1];
        let bestDistance = Infinity;
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const distance = dist2(paletteLab[ids[i]], paletteLab[ids[j]]);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestA = ids[i];
                    bestB = ids[j];
                }
            }
        }
        const drop = counts.get(bestA) < counts.get(bestB) ? bestA : bestB;
        const keep = drop === bestA ? bestB : bestA;
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] === drop) cells[i] = keep;
        }
        counts.set(keep, counts.get(keep) + counts.get(drop));
        counts.delete(drop);
    }
    return cells;
}

function convertImage(image) {
    const size = currentTargetSize();
    const maxColors = currentColorLimit();
    const removeBg = !!removeBgInput.checked;
    const tolerance = currentTolerance();
    const stretch = !!stretchInput.checked;
    const raster = rasterize(image, 420);
    maskBackground(raster, removeBg, tolerance);
    const cells = sampleToGrid(raster, size, stretch);
    reduceToMaxColors(cells, maxColors);
    const grid = new Map();
    const used = new Set();
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = cells[y * size + x];
            if (index < 0) continue;
            const hex = PALETTE[index].hex;
            grid.set(x + ',' + y, hex);
            used.add(hex);
        }
    }
    return {
        size: size,
        grid: grid,
        beads: grid.size,
        colors: used.size,
        maxColors: maxColors,
        removeBg: removeBg
    };
}

function drawPreview(result) {
    const cell = 8;
    const size = result.size;
    previewCanvas.width = size * cell;
    previewCanvas.height = size * cell;
    const previewCtx = previewCanvas.getContext('2d');
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.strokeStyle = 'rgba(229, 119, 159, 0.9)';
    previewCtx.strokeRect(0.5, 0.5, size * cell - 1, size * cell - 1);
    result.grid.forEach(function (hex, key) {
        const parts = key.split(',');
        drawBead(previewCtx, Number(parts[0]), Number(parts[1]), hex, cell);
    });
    previewCtx.beginPath();
    previewCtx.strokeStyle = 'rgba(231, 168, 194, 0.95)';
    previewCtx.lineWidth = 1.5;
    for (let i = PEGBOARD; i < size; i += PEGBOARD) {
        previewCtx.moveTo(i * cell + 0.5, 0);
        previewCtx.lineTo(i * cell + 0.5, size * cell);
        previewCtx.moveTo(0, i * cell + 0.5);
        previewCtx.lineTo(size * cell, i * cell + 0.5);
    }
    previewCtx.stroke();
    previewCanvas.dataset.beads = String(result.beads);
    previewCanvas.dataset.colors = String(result.colors);
    previewCanvas.dataset.size = String(result.size);
}

function renderPreviewNow() {
    window.cancelAnimationFrame(previewFrame);
    if (!sourceImage) {
        previewResult = null;
        applyBtn.disabled = true;
        return null;
    }
    try {
        const result = convertImage(sourceImage);
        previewResult = result;
        drawPreview(result);
        applyBtn.disabled = result.beads === 0;
        convertStatus.textContent = result.beads === 0
            ? 'ビーズが置けませんでした。背景の抜き具合を下げるか、オフにしてください。'
            : result.size + '×' + result.size + '・' + result.colors + '色・' + result.beads + 'ビーズ';
        return result;
    } catch (err) {
        previewResult = null;
        applyBtn.disabled = true;
        convertStatus.textContent = '変換に失敗しました。別の画像で試してください。';
        return null;
    }
}

function schedulePreview() {
    if (!sourceImage) return;
    window.cancelAnimationFrame(previewFrame);
    previewFrame = window.requestAnimationFrame(function () {
        renderPreviewNow();
    });
}

function replaceSource(image) {
    if (sourceImage && sourceImage !== image && typeof sourceImage.close === 'function') {
        sourceImage.close();
    }
    sourceImage = image;
    renderPreviewNow();
}

function loadUrl(url, revoke) {
    return new Promise(function (resolve, reject) {
        const img = new Image();
        img.onload = function () {
            if (revoke) URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = function () {
            if (revoke) URL.revokeObjectURL(url);
            reject(new Error('load'));
        };
        img.src = url;
    });
}

function isImageFile(file) {
    if (file.type && file.type.indexOf('image/') === 0) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || '');
}

function imageLoadErrorMessage(file) {
    const name = ((file && file.name) || '').toLowerCase();
    const type = ((file && file.type) || '').toLowerCase();
    if (type.indexOf('heic') !== -1 || type.indexOf('heif') !== -1 || /\.heic$|\.heif$/.test(name)) {
        return 'HEIC形式は読み込めません。写真アプリでJPEGにしてから選んでください。';
    }
    return 'この画像は読み込めませんでした。JPEGまたはPNGで試してください。';
}

async function imageFromFile(file) {
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file);
        } catch (err) {
            // Fall through to an <img> decode.
        }
    }
    const url = URL.createObjectURL(file);
    return loadUrl(url, true);
}

async function loadFile(file) {
    if (!file || !isImageFile(file)) {
        convertStatus.textContent = '画像ファイルを選んでください。';
        return;
    }
    convertPanel.open = true;
    convertStatus.textContent = '画像を読み込んでいます…';
    try {
        const image = await imageFromFile(file);
        replaceSource(image);
    } catch (err) {
        convertStatus.textContent = imageLoadErrorMessage(file);
    }
}

async function loadSample(name) {
    const url = SAMPLES[name];
    if (!url) return;
    convertPanel.open = true;
    convertStatus.textContent = 'サンプルを読み込んでいます…';
    try {
        const image = await loadUrl(url, false);
        replaceSource(image);
    } catch (err) {
        convertStatus.textContent = 'サンプルを読み込めませんでした。';
    }
}

function applyConversion() {
    const result = renderPreviewNow();
    if (!result || result.beads === 0) return;
    perlerGrid = new Map(result.grid);
    setBoard(result.size, { fit: true, draw: false });
    commit();
    drawMainCanvas();
    setTool('pen');
    trackEvent('image_convert', {
        target_size: result.size + 'x' + result.size,
        color_limit: result.maxColors,
        color_count: result.colors,
        bead_count: result.beads,
        remove_background: result.removeBg ? 'on' : 'off'
    });
    flashStatus('図案を読み込みました。ペンや塗りつぶしで直せます。');
    convertPanel.open = false;
    const editor = document.getElementById('editor');
    const rect = editor.getBoundingClientRect();
    const fullyVisible = rect.top >= 48 && rect.bottom <= window.innerHeight - 8;
    if (!fullyVisible) {
        const top = Math.max(0, rect.top + window.scrollY - 68);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
}

function isTypingTarget(element) {
    if (!element || !element.tagName) return false;
    const tag = element.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return !!element.isContentEditable;
    const type = (element.getAttribute('type') || 'text').toLowerCase();
    return type === 'text' || type === 'search' || type === 'number' || type === 'email' || type === 'url';
}

function syncToleranceField() {
    const enabled = !!removeBgInput.checked;
    bgToleranceInput.disabled = !enabled;
    toleranceField.classList.toggle('is-disabled', !enabled);
}

function bindEvents() {
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('touchstart', function (event) {
        if (event.target === canvas) event.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', function (event) {
        if (event.target === canvas) event.preventDefault();
    }, { passive: false });
    canvas.addEventListener('wheel', function (event) {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const factor = event.deltaY < 0 ? 1.1 : (1 / 1.1);
        zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor);
    }, { passive: false });

    zoomInBtn.addEventListener('click', function () {
        zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1.2);
    });
    zoomOutBtn.addEventListener('click', function () {
        zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1 / 1.2);
    });
    clearBtn.addEventListener('click', clearPattern);
    downloadBtn.addEventListener('click', downloadPattern);
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    toolPen.addEventListener('click', function () { setTool('pen'); });
    toolEraser.addEventListener('click', function () { setTool('eraser'); });
    toolFill.addEventListener('click', function () { setTool('fill'); });
    if (toolPicker) {
        toolPicker.addEventListener('click', function () { setTool('picker'); });
    }
    if (toolPhoto) {
        toolPhoto.addEventListener('click', function () {
            convertPanel.open = true;
        });
    }
    if (convertClose) {
        convertClose.addEventListener('click', function () {
            convertPanel.open = false;
        });
    }
    convertPanel.addEventListener('click', function (event) {
        if (event.target === convertPanel) convertPanel.open = false;
    });
    convertPanel.addEventListener('toggle', function () {
        if (!toolPhoto) return;
        toolPhoto.classList.toggle('is-active', convertPanel.open);
        toolPhoto.setAttribute('aria-expanded', convertPanel.open ? 'true' : 'false');
    });
    countToggle.addEventListener('click', function () {
        setCountOpen(countPanel.classList.contains('is-collapsed'));
    });

    document.querySelectorAll('[data-board]').forEach(function (button) {
        button.addEventListener('click', function () {
            setBoard(Number(button.dataset.board), { fit: true });
        });
    });
    document.querySelectorAll('[data-target-size]').forEach(function (button) {
        button.addEventListener('click', function () {
            setTargetSize(Number(button.dataset.targetSize));
        });
    });
    document.querySelectorAll('[data-sample]').forEach(function (button) {
        button.addEventListener('click', function () {
            loadSample(button.dataset.sample);
        });
    });

    imageInput.addEventListener('change', function () {
        const file = imageInput.files && imageInput.files[0];
        if (file) loadFile(file);
        imageInput.value = '';
    });
    colorCountInput.addEventListener('input', function () {
        colorLimitCustom = true;
        colorCountValue.textContent = colorCountInput.value;
        schedulePreview();
    });
    removeBgInput.addEventListener('change', function () {
        syncToleranceField();
        schedulePreview();
    });
    bgToleranceInput.addEventListener('input', function () {
        bgToleranceValue.textContent = bgToleranceInput.value;
        schedulePreview();
    });
    stretchInput.addEventListener('change', schedulePreview);
    applyBtn.addEventListener('click', applyConversion);

    convertPanel.addEventListener('dragover', function (event) {
        event.preventDefault();
        convertPanel.classList.add('is-dragover');
    });
    convertPanel.addEventListener('dragleave', function () {
        convertPanel.classList.remove('is-dragover');
    });
    convertPanel.addEventListener('drop', function (event) {
        event.preventDefault();
        event.stopPropagation();
        convertPanel.classList.remove('is-dragover');
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (file) loadFile(file);
    });

    const workspace = document.querySelector('.workspace');
    if (workspace) {
        workspace.addEventListener('dragover', function (event) {
            event.preventDefault();
            workspace.classList.add('is-dragover');
        });
        workspace.addEventListener('dragleave', function (event) {
            if (!workspace.contains(event.relatedTarget)) workspace.classList.remove('is-dragover');
        });
        workspace.addEventListener('drop', function (event) {
            event.preventDefault();
            workspace.classList.remove('is-dragover');
            const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
            if (file) loadFile(file);
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && convertPanel.open) {
            convertPanel.open = false;
            return;
        }
        if (isTypingTarget(event.target)) return;
        const meta = event.metaKey || event.ctrlKey;
        if (!meta) return;
        const key = event.key.toLowerCase();
        if (key === 'z') {
            event.preventDefault();
            if (event.shiftKey) redo();
            else undo();
        } else if (key === 'y') {
            event.preventDefault();
            redo();
        }
    });

    document.querySelectorAll('[data-track="bead_guide_click"]').forEach(function (link) {
        link.addEventListener('click', function () {
            trackEvent('bead_guide_click', {
                link_location: link.dataset.linkLocation || 'unknown',
                transport_type: 'beacon'
            });
        });
    });
    document.querySelectorAll('a[href="#convert"]').forEach(function (link) {
        link.addEventListener('click', function () {
            convertPanel.open = true;
        });
    });
    window.addEventListener('hashchange', function () {
        if (location.hash === '#convert') convertPanel.open = true;
    });
    window.addEventListener('resize', resizeCanvas);
}

function init() {
    buildPalette();
    setTool('pen');
    setBoard(29, { fit: false, draw: false });
    setTargetSize(29);
    colorLimitCustom = false;
    syncToleranceField();
    refreshCounts();
    refreshHistoryButtons();
    bindEvents();
    if (location.hash === '#convert') convertPanel.open = true;
    const copyrightYear = document.getElementById('copyright-year');
    if (copyrightYear) copyrightYear.textContent = String(new Date().getFullYear());
    resizeCanvas();
}

init();
