// Rebuild bead previews and the pattern cards embedded in the HTML pages.
// After editing data/patterns.json, run: node scripts/build-patterns.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
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
const nameByHex = new Map(PALETTE.map((color) => [color.hex.toUpperCase(), color.name]));
const BOARDS = new Set([15, 20, 29, 58]);
const BANNED = ['ポケモン', 'ピカチュウ', 'サンリオ', 'ハローキティ', 'キティ', 'マリオ', 'スヌーピー', 'マイクラ', 'マインクラフト', 'ディズニー', 'カービィ', 'ドラえもん', 'トトロ', 'アンパンマン', 'ちいかわ', 'すみっコ', 'たまごっち', 'プリクラ', 'デコログ', 'ボンドロ', 'pokemon', 'mario', 'snoopy', 'minecraft', 'disney', 'kirby', 'mickey', 'sanrio', 'hello kitty', 'tamagotchi'];

function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

function readCatalog() {
    const data = JSON.parse(readFileSync(join(root, 'data/patterns.json'), 'utf8'));
    const legend = data.legend || {};
    const known = new Set(Object.values(legend).map((hex) => String(hex).toUpperCase()));
    for (const hex of known) {
        if (!nameByHex.has(hex)) throw new Error('legend hex not in palette: ' + hex);
    }
    const ids = new Set();
    for (const pattern of data.patterns) {
        if (!/^[a-z0-9-]{1,48}$/.test(pattern.id)) throw new Error('bad id ' + pattern.id);
        if (ids.has(pattern.id)) throw new Error('duplicate ' + pattern.id);
        ids.add(pattern.id);
        if (!BOARDS.has(pattern.board)) throw new Error(pattern.id + ' board');
        if (!pattern.title || !pattern.blurb || !pattern.category) throw new Error(pattern.id + ' missing text');
        const blob = pattern.title + '\n' + pattern.blurb;
        for (const word of BANNED) {
            if (blob.toLowerCase().includes(word.toLowerCase())) throw new Error(pattern.id + ' banned ' + word);
        }
        const widths = pattern.rows.map((row) => row.length);
        const width = widths[0];
        if (!width || widths.some((item) => item !== width)) {
            throw new Error(pattern.id + ' ragged rows ' + widths.join(','));
        }
        if (width > pattern.board || pattern.rows.length > pattern.board) {
            throw new Error(pattern.id + ' exceeds board ' + width + 'x' + pattern.rows.length);
        }
        let beads = 0;
        for (const row of pattern.rows) {
            for (const ch of row) {
                if (ch === '.') continue;
                if (!legend[ch]) throw new Error(pattern.id + ' unknown char ' + ch);
                beads += 1;
            }
        }
        if (beads < 4) throw new Error(pattern.id + ' too few beads');
    }
    const hub = data.patterns.filter((item) => ['heart', 'flower', 'animal', 'food'].includes(item.category));
    const xmas = data.patterns.filter((item) => item.category === 'christmas');
    if (hub.length < 30) throw new Error('hub patterns ' + hub.length);
    if (xmas.length < 10) throw new Error('christmas patterns ' + xmas.length);
    const sections = new Set(['ornament', 'character', 'decor', 'lettering', 'large']);
    for (const pattern of xmas) {
        if (!sections.has(pattern.section)) throw new Error(pattern.id + ' section');
    }
    return data;
}

function stats(pattern, legend) {
    const counts = new Map();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -1;
    let maxY = -1;
    pattern.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) {
            const hex = legend[row[x]];
            if (!hex) continue;
            counts.set(hex, (counts.get(hex) || 0) + 1);
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    });
    const list = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return {
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        total: list.reduce((sum, row) => sum + row[1], 0),
        list
    };
}

function beadMarkup(rows, legend, ox, oy, cell) {
    let body = '';
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) {
            const hex = legend[row[x]];
            if (!hex) continue;
            const cx = ox + x * cell + cell / 2;
            const cy = oy + y * cell + cell / 2;
            const r = cell * 0.42;
            body += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${hex}" stroke="rgba(74,58,68,0.35)" stroke-width="0.7"/>`;
            body += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(r * 0.28).toFixed(2)}" fill="#ffffff"/>`;
        }
    });
    return body;
}

function svgFromRows(rows, legend, label) {
    const height = rows.length;
    const width = Math.max(...rows.map((row) => row.length));
    const cell = 14;
    const pad = 10;
    const pixelW = pad * 2 + width * cell;
    const pixelH = pad * 2 + height * cell;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pixelW} ${pixelH}" width="${pixelW}" height="${pixelH}" role="img" aria-label="${esc(label)}">\n<rect width="${pixelW}" height="${pixelH}" rx="16" fill="#FFF5F8"/>\n${beadMarkup(rows, legend, pad, pad, cell)}</svg>\n`;
    return { svg, pixelW, pixelH };
}

function writeSvg(file, svg) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, svg);
}

function card(pattern, legend) {
    const info = stats(pattern, legend);
    const { svg, pixelW, pixelH } = svgFromRows(pattern.rows, legend, pattern.title + 'のビーズ図案');
    writeSvg(join(root, 'patterns/previews', pattern.id + '.svg'), svg);
    const counts = info.list.map(([hex, count]) => {
        return `<li><span class="dot" style="background:${esc(hex)}"></span>${esc(nameByHex.get(hex.toUpperCase()))} <b>${count}</b></li>`;
    }).join('');
    return `<article class="pattern-card" id="${esc(pattern.id)}">
<a class="pattern-shot" href="/?pattern=${esc(pattern.id)}"><img src="/patterns/previews/${esc(pattern.id)}.svg" width="${pixelW}" height="${pixelH}" alt="${esc(pattern.title)}のビーズ図案"></a>
<h3>${esc(pattern.title)}</h3>
<p class="pattern-blurb">${esc(pattern.blurb)}</p>
<p class="pattern-meta">モチーフ ${info.w}×${info.h} · ボード ${pattern.board}×${pattern.board} · ${info.total}粒</p>
<ul class="bead-counts">${counts}</ul>
<a class="btn btn-primary pattern-open" href="/?pattern=${esc(pattern.id)}">エディタで開く</a>
</article>`;
}

function groupPatterns(data, key) {
    if (key.startsWith('cat:')) {
        const category = key.slice(4);
        return data.patterns.filter((item) => item.category === category);
    }
    if (key.startsWith('sec:')) {
        const section = key.slice(4);
        return data.patterns.filter((item) => item.section === section);
    }
    if (key.startsWith('ids:')) {
        const ids = key.slice(4).split(',').filter(Boolean);
        return ids.map((id) => {
            const found = data.patterns.find((item) => item.id === id);
            if (!found) throw new Error('missing pattern ' + id);
            return found;
        });
    }
    throw new Error('bad pattern group ' + key);
}

const shownPatterns = new Set();

function fillHtml(file, data) {
    const full = join(root, file);
    let html = readFileSync(full, 'utf8');
    const re = /<!-- @patterns (\S+) -->[\s\S]*?<!-- @\/patterns \1 -->/g;
    let count = 0;
    html = html.replace(re, (match, key) => {
        count += 1;
        const group = groupPatterns(data, key);
        group.forEach((item) => shownPatterns.add(item.id));
        const cards = group.map((item) => card(item, data.legend)).join('\n');
        return `<!-- @patterns ${key} -->\n${cards}\n<!-- @/patterns ${key} -->`;
    });
    if (!count) throw new Error('no pattern markers in ' + file);
    writeFileSync(full, html);
}

function diagramRows() {
    const houseFilled = [
        '.....t.....',
        '....ttt....',
        '...ttttt...',
        '..ttttttt..',
        '.ttttttttt.',
        'CCCCCCCCCCC',
        'C..YY..YY.C',
        'C..YY..YY.C',
        'C....tt...C',
        'C....tt...C',
        'CCCCCCCCCCC'
    ];
    const houseOutline = [
        '.....t.....',
        '....t.t....',
        '...t...t...',
        '..t.....t..',
        '.t.......t.',
        'CCCCCCCCCCC',
        'C.........C',
        'C.........C',
        'C....tt...C',
        'C....tt...C',
        'CCCCCCCCCCC'
    ];
    const weak = ['P.P.P', '.P.P.', 'P.P.P'];
    const strong = ['PPPPP', 'PPPPP', 'PPPPP'];
    return { houseFilled, houseOutline, weak, strong };
}

function sideBySide(left, right, legend, label) {
    const cell = 16;
    const pad = 12;
    const gap = 3;
    const leftW = left[0].length;
    const rightW = right[0].length;
    const height = Math.max(left.length, right.length);
    const pixelW = pad * 2 + (leftW + gap + rightW) * cell;
    const pixelH = pad * 2 + height * cell;
    const body = beadMarkup(left, legend, pad, pad, cell)
        + beadMarkup(right, legend, pad + (leftW + gap) * cell, pad, cell);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pixelW} ${pixelH}" width="${pixelW}" height="${pixelH}" role="img" aria-label="${esc(label)}">\n<rect width="${pixelW}" height="${pixelH}" rx="16" fill="#FFF5F8"/>\n${body}</svg>\n`;
}

function solidFace(ch, size) {
    return Array.from({ length: size }, () => ch.repeat(size));
}

function placeFace(grid, rows, ox, oy) {
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) grid[oy + y][ox + x] = row[x];
    });
}

function gridSvg(grid, legend, label) {
    const rows = grid.map((row) => row.join(''));
    return svgFromRows(rows, legend, label).svg;
}

function cubeNet(legend) {
    const gap = 1;
    const n = 6;
    const cols = n * 3 + gap * 2;
    const faceRows = n * 4 + gap * 3;
    const grid = Array.from({ length: faceRows }, () => Array(cols).fill('.'));
    const faces = {
        top: solidFace('Y', n),
        left: solidFace('m', n),
        front: solidFace('P', n),
        right: solidFace('b', n),
        bottom: solidFace('C', n),
        back: solidFace('L', n)
    };
    const x1 = n + gap;
    const x2 = (n + gap) * 2;
    placeFace(grid, faces.top, x1, 0);
    placeFace(grid, faces.left, 0, n + gap);
    placeFace(grid, faces.front, x1, n + gap);
    placeFace(grid, faces.right, x2, n + gap);
    placeFace(grid, faces.bottom, x1, (n + gap) * 2);
    placeFace(grid, faces.back, x1, (n + gap) * 3);
    return gridSvg(grid, legend, '立方体の展開図。上段が上面、中段が左・手前・右、その下が底、一番下が奥の面');
}

function rotateRows(rows) {
    const h = rows.length;
    const w = rows[0].length;
    const out = Array.from({ length: w }, () => Array(h).fill('.'));
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) out[x][h - 1 - y] = rows[y][x];
    }
    return out.map((row) => row.join(''));
}

function boxNet(catalog) {
    const bottom = catalog.patterns.find((item) => item.id === 'lesson-box-bottom').rows;
    const wall = catalog.patterns.find((item) => item.id === 'lesson-box-wall').rows;
    const left = rotateRows(wall);
    const right = rotateRows(rotateRows(rotateRows(wall)));
    const gap = 1;
    const bw = bottom[0].length;
    const bh = bottom.length;
    const sideW = left[0].length;
    const wallH = wall.length;
    const cols = sideW + gap + bw + gap + sideW;
    const faceRows = wallH + gap + bh + gap + wallH;
    const grid = Array.from({ length: faceRows }, () => Array(cols).fill('.'));
    placeFace(grid, wall, sideW + gap, 0);
    placeFace(grid, left, 0, wallH + gap);
    placeFace(grid, bottom, sideW + gap, wallH + gap);
    placeFace(grid, right, sideW + gap + bw + gap, wallH + gap);
    placeFace(grid, wall, sideW + gap, wallH + gap + bh + gap);
    return gridSvg(grid, catalog.legend, '小物入れの展開図。中央が底、上下と左右が側面');
}

function ironSvg() {
    const beads = [
        ['#E2231A', 78], ['#FFD400', 110], ['#4FC3F7', 142], ['#2E9E44', 174], ['#FF9BB3', 206]
    ];
    const circles = beads.map(([fill, cx]) => {
        return `<circle cx="${cx}" cy="112" r="14" fill="${fill}" stroke="rgba(74,58,68,0.35)" stroke-width="1"/><circle cx="${cx}" cy="112" r="4" fill="#fff"/>`;
    }).join('');
    const pegs = [78, 110, 142, 174, 206].map((cx) => `<rect x="${cx - 3}" y="132" width="6" height="16" rx="2" fill="#E5779F"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 210" width="280" height="210" role="img" aria-label="上からアイロン、アイロンペーパー、ビーズ、プレートの順に重なる断面">\n<rect width="280" height="210" rx="16" fill="#FFF5F8"/>\n<rect x="118" y="16" width="44" height="16" rx="6" fill="#9E9E9E"/>\n<rect x="70" y="30" width="140" height="26" rx="8" fill="#E6E6E6" stroke="#5C5C5C"/>\n<rect x="52" y="78" width="176" height="12" rx="2" fill="#ffffff" stroke="#E7A8C2" stroke-dasharray="4 3"/>\n${circles}\n<rect x="46" y="146" width="188" height="34" rx="8" fill="#FBD9E6" stroke="#E5779F"/>\n${pegs}\n</svg>\n`;
}

function seamSvg() {
    const cell = 18;
    const beads = [];
    for (let x = 0; x < 7; x += 1) beads.push({ x, y: 5, fill: '#FF9BB3' });
    for (let y = 0; y < 5; y += 1) beads.push({ x: 0, y, fill: '#B3D4FF' });
    const pad = 16;
    const width = pad * 2 + 7 * cell;
    const height = pad * 2 + 6 * cell;
    const body = beads.map((bead) => {
        const cx = pad + bead.x * cell + cell / 2;
        const cy = pad + bead.y * cell + cell / 2;
        return `<circle cx="${cx}" cy="${cy}" r="${(cell * 0.42).toFixed(2)}" fill="${bead.fill}" stroke="rgba(74,58,68,0.35)" stroke-width="0.8"/><circle cx="${cx}" cy="${cy}" r="2.4" fill="#fff"/>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="ピンクの面と水色の面が角で接している図">\n<rect width="${width}" height="${height}" rx="16" fill="#FFF5F8"/>\n${body}</svg>\n`;
}

function writeDiagrams(catalog) {
    const legend = {
        ...catalog.legend,
        C: '#FFF3D0',
        Y: catalog.legend.Y,
        P: catalog.legend.P
    };
    const rows = diagramRows();
    const dir = join(root, 'img/diagrams');
    writeSvg(join(dir, 'house-outline.svg'), svgFromRows(rows.houseOutline, legend, '輪郭だけ置いた家').svg);
    writeSvg(join(dir, 'house-filled.svg'), svgFromRows(rows.houseFilled, legend, '中まで塗った家').svg);
    writeSvg(join(dir, 'join-weak-strong.svg'), sideBySide(rows.weak, rows.strong, legend, '左は角だけで接するビーズ、右は辺で接するビーズ'));
    writeSvg(join(dir, 'iron-stack.svg'), ironSvg());
    writeSvg(join(dir, 'cube-net.svg'), cubeNet(legend));
    writeSvg(join(dir, 'box-net.svg'), boxNet(catalog));
    writeSvg(join(dir, 'seam.svg'), seamSvg());
}

const catalog = readCatalog();
mkdirSync(join(root, 'patterns/previews'), { recursive: true });
for (const pattern of catalog.patterns) card(pattern, catalog.legend);
writeDiagrams(catalog);
for (const file of ['zuan.html', 'christmas.html', 'fuyu.html', 'oshogatsu.html', 'aquabeads.html', 'perler.html', 'nanobeads.html', 'rittai.html', 'oshare.html', 'kantan.html', 'kyoryu-umi.html', 'sweets.html', 'heisei-retro.html', 'moji.html', 'kisetsu.html']) {
    fillHtml(file, catalog);
}
for (const pattern of catalog.patterns) {
    if (!shownPatterns.has(pattern.id)) throw new Error('not on a page ' + pattern.id);
}
console.log('patterns', catalog.patterns.length);
