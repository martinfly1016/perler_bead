// Headless checks for the free print PDF.
// node scripts/test-print-pdf.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/tmp/pdfwork/package.json');
const puppeteer = require('puppeteer-core');
const root = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

function listen() {
    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://127.0.0.1');
            let pathname = decodeURIComponent(url.pathname);
            if (pathname.endsWith('/')) pathname += 'index.html';
            let file = normalize(join(root, pathname));
            if (!extname(file)) file += '.html';
            if (!file.startsWith(root)) {
                res.writeHead(403);
                res.end();
                return;
            }
            const body = await readFile(file);
            res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
            res.end(body);
        } catch (err) {
            res.writeHead(404);
            res.end('not found');
        }
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

function near(value, expected, tolerance) {
    return Math.abs(value - expected) <= tolerance;
}

function pdfPages(buffer) {
    const data = Buffer.from(buffer);
    const latin = data.toString('latin1');
    const boxes = [...latin.matchAll(/\/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]/g)]
        .map((match) => ({
            width: Number(match[3]) - Number(match[1]),
            height: Number(match[4]) - Number(match[2])
        }));
    const cmap = new Map();
    const streams = [];
    let pos = 0;
    while (pos < data.length) {
        const marker = data.indexOf('stream', pos);
        if (marker < 0) break;
        const prelude = data.subarray(Math.max(0, marker - 120), marker).toString('latin1');
        if (!/>>\s*$/.test(prelude)) {
            pos = marker + 6;
            continue;
        }
        let start = marker + 6;
        if (data[start] === 13) start += 1;
        if (data[start] === 10) start += 1;
        const lengths = [...prelude.matchAll(/\/Length(?!1)\s+(\d+)/g)];
        let raw;
        let next;
        if (lengths.length) {
            const length = Number(lengths[lengths.length - 1][1]);
            raw = data.subarray(start, start + length);
            next = start + length;
        } else {
            const end = data.indexOf('endstream', start);
            raw = data.subarray(start, end);
            next = end + 9;
        }
        let decoded;
        try {
            decoded = inflateSync(raw);
        } catch (err) {
            decoded = raw;
        }
        streams.push(decoded.toString('latin1'));
        pos = next;
    }
    for (const text of streams) {
        for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
            for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
                cmap.set(pair[1].toLowerCase(), String.fromCodePoint(parseInt(pair[2], 16)));
            }
        }
        for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
            for (const range of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
                const from = parseInt(range[1], 16);
                const to = parseInt(range[2], 16);
                let code = parseInt(range[3], 16);
                for (let value = from; value <= to; value += 1) {
                    cmap.set(value.toString(16).padStart(range[1].length, '0'), String.fromCodePoint(code));
                    code += 1;
                }
            }
        }
    }
    const pages = streams.filter((text) => text.includes(' re') && (text.includes('Tj') || text.includes('TJ')));
    return pages.map((text, index) => {
        const lines = [];
        for (const hex of text.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
            let word = '';
            const raw = hex[1];
            for (let i = 0; i < raw.length; i += 4) {
                word += cmap.get(raw.slice(i, i + 4).toLowerCase()) || '';
            }
            if (word) lines.push(word);
        }
        for (const literal of text.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
            const body = literal[0].replace(/\)\s*Tj$/, '').slice(1);
            lines.push(body.replace(/\\([()\\])/g, '$1'));
        }
        const rects = [...text.matchAll(/([0-9.]+)\s+([0-9.-]+)\s+([0-9.]+)\s+([0-9.-]+)\s+re/g)].map((match) => ({
            x: Number(match[1]),
            y: Number(match[2]),
            w: Math.abs(Number(match[3])),
            h: Math.abs(Number(match[4]))
        }));
        return {
            index,
            box: boxes[index] || boxes[0],
            text: lines.join('\n'),
            rects
        };
    });
}

function legendFromText(text) {
    const rows = [];
    for (const line of text.split('\n')) {
        const match = line.match(/^(\d+)\s+(\S+)\s+(\d+)$/);
        if (match) rows.push({ number: Number(match[1]), name: match[2], count: Number(match[3]) });
    }
    const total = text.match(/合計\s+(\d+)粒/);
    return { rows, total: total ? Number(total[1]) : null };
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function cellsOf(page, pitch) {
    return page.rects.filter((rect) => near(rect.w, pitch, 0.03) && near(rect.h, pitch, 0.03));
}

function assertPitch(page, pitch, label) {
    const cells = cellsOf(page, pitch);
    assert(cells.length > 0, label + ' has no cells at ' + pitch);
    const xs = [...new Set(cells.map((cell) => cell.x.toFixed(2)))].map(Number).sort((a, b) => a - b);
    const ys = [...new Set(cells.map((cell) => cell.y.toFixed(2)))].map(Number).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) {
        assert(near(xs[i] - xs[i - 1], pitch, 0.03), label + ' x pitch ' + (xs[i] - xs[i - 1]));
    }
    for (let i = 1; i < ys.length; i += 1) {
        assert(near(ys[i] - ys[i - 1], pitch, 0.03), label + ' y pitch ' + (ys[i] - ys[i - 1]));
    }
    const ruler = page.rects.find((rect) => near(rect.w, 141.73, 0.05) && rect.h < 1.2);
    assert(ruler, label + ' missing 5cm ruler');
    return cells.length;
}

function assertA4(pages, label) {
    assert(pages.length > 0, label + ' has no pages');
    pages.forEach((page, index) => {
        assert(page.box, label + ' page ' + index + ' has no MediaBox');
        assert(near(page.box.width, 595.28, 0.05), label + ' width ' + page.box.width);
        assert(near(page.box.height, 841.89, 0.05), label + ' height ' + page.box.height);
    });
}

function assertLegend(pages, editorRows, total, label) {
    const combined = pages.map((page) => page.text).join('\n');
    const legend = legendFromText(combined);
    assert(legend.total === total, label + ' total ' + legend.total + ' != ' + total);
    editorRows.forEach((row, index) => {
        const found = legend.rows.find((item) => item.number === index + 1);
        assert(found, label + ' missing legend number ' + (index + 1) + ' in ' + legend.rows.map((item) => item.name).join(','));
        assert(found.name === row.name, label + ' name ' + found.name + ' != ' + row.name);
        assert(found.count === row.count, label + ' count ' + found.count + ' != ' + row.count + ' for ' + row.name);
    });
    assert(combined.includes('https://beads.mojimoon.com'), label + ' missing URL');
    assert(combined.includes('100%'), label + ' missing 100% instruction');
    assert(combined.includes('実際のサイズ'), label + ' missing 実際のサイズ');
}

const thirdParty = /googletagmanager|google-analytics|fonts\.googleapis|fonts\.gstatic|gstatic\.com/;

function watch(page, bucket) {
    page.on('pageerror', (err) => bucket.push('pageerror: ' + err.message));
    page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (thirdParty.test(text)) return;
        bucket.push('console: ' + text);
    });
    page.on('requestfailed', (req) => {
        const url = req.url();
        if (thirdParty.test(url)) return;
        bucket.push('requestfailed: ' + url + ' ' + (req.failure() && req.failure().errorText));
    });
}

async function editorCounts(page) {
    return page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#countList .count-row')).map((row) => ({
            name: row.querySelector('.count-name').textContent,
            count: Number(row.dataset.count)
        }));
        return {
            rows,
            total: Number(document.querySelector('#countTotal').dataset.total),
            board: document.querySelector('#perlerCanvas').dataset.boardSize
        };
    });
}

async function installCapture(page) {
    await page.evaluate(() => {
        window.__pdfCaptures = [];
        window.__capturePdf = function (buffer, name) {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const size = 4096;
            for (let i = 0; i < bytes.length; i += size) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + size, bytes.length)));
            }
            window.__pdfCaptures.push({ name: name, b64: btoa(binary) });
        };
    });
}

async function downloadPdf(page) {
    const before = await page.evaluate(() => window.__pdfCaptures.length);
    await page.click('#printDownload');
    await page.waitForFunction((count) => window.__pdfCaptures.length > count, { timeout: 60000 }, before);
    const captured = await page.evaluate(() => window.__pdfCaptures[window.__pdfCaptures.length - 1]);
    const event = await page.evaluate(() => {
        const hit = (window.dataLayer || []).find((entry) => entry && entry[0] === 'event' && entry[1] === 'pdf_export');
        return hit ? { name: hit[1], params: hit[2] } : null;
    });
    return {
        name: captured.name,
        buffer: Buffer.from(captured.b64, 'base64'),
        event
    };
}

async function main() {
    const server = await listen();
    const port = server.address().port;
    const base = 'http://127.0.0.1:' + port;
    const browser = await puppeteer.launch({
        executablePath: '/usr/local/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const report = [];
    const saved = [];
    try {
        const page = await browser.newPage();
        const errors = [];
        watch(page, errors);
        for (const width of [390, 1280]) {
            await page.setViewport({ width, height: width === 390 ? 844 : 800 });
            for (const path of ['/', '/zuan', '/guide', '/tsukurikata', '/?pattern=heart-classic&pdf=1']) {
                errors.length = 0;
                await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
                if (path.startsWith('/?pattern')) {
                    await page.waitForFunction(() => document.querySelector('#countTotal') && document.querySelector('#countTotal').dataset.total === '70', { timeout: 15000 });
                    await page.waitForSelector('#printDialog[open]', { timeout: 10000 });
                    const box = await page.$eval('.print-sheet', (el) => {
                        const rect = el.getBoundingClientRect();
                        return { width: rect.width, height: rect.height, top: rect.top, left: rect.left };
                    });
                    assert(box.left >= -1 && box.top >= -1, width + ' dialog offscreen ' + JSON.stringify(box));
                    assert(box.left + box.width <= width + 1, width + ' dialog wider than viewport ' + JSON.stringify(box));
                }
                if (path === '/zuan') {
                    const count = await page.$$eval('a.pattern-print', (nodes) => nodes.length);
                    assert(count === 51, 'zuan print buttons ' + count);
                    const href = await page.$eval('a.pattern-print', (node) => node.getAttribute('href'));
                    assert(href.includes('pdf=1') && href.includes('pattern='), 'print href ' + href);
                }
                if (path === '/guide' || path === '/tsukurikata') {
                    const text = await page.$eval('#print', (el) => el.textContent);
                    assert(text.includes('100%'), path + ' print section');
                }
                await new Promise((resolve) => setTimeout(resolve, 400));
                assert(errors.length === 0, width + ' ' + path + ' errors:\n' + errors.join('\n'));
                report.push(width + ' ' + path + ' ok');
            }
        }

        await page.setViewport({ width: 1280, height: 800 });
        await installCapture(page);
        const heartCounts = await editorCounts(page);
        assert(heartCounts.board === '15', 'heart board ' + heartCounts.board);
        assert(await page.$eval('input[name="beadType"]:checked', (el) => el.value) === 'standard', 'default bead is not standard');
        const heart = await downloadPdf(page);
        const heartPages = pdfPages(heart.buffer);
        assertA4(heartPages, 'heart');
        assert(heartPages.length === 2, 'heart pages ' + heartPages.length);
        assert(assertPitch(heartPages[0], 14.17, 'heart') === 225, 'heart cell count');
        assertLegend(heartPages, heartCounts.rows, heartCounts.total, 'heart');
        assert(heartPages[0].text.includes('まんなかハート'), 'heart title');
        assert(heartPages[0].text.includes('1/1（1行目・1列目）'), 'heart page label ' + heartPages[0].text);
        assert(heartPages[1].text.includes('実寸ではありません'), 'overview note');
        assert(cellsOf(heartPages[1], 14.17).length === 0, 'overview is not 1:1');
        assert(heart.event && heart.event.params.board_size === '15x15', 'ga ' + JSON.stringify(heart.event));
        saved.push(['heart-15', heart.buffer]);
        report.push('heart 15x15 pdf ok pages=' + heartPages.length + ' cells=225 pitch=14.17');

        await page.click('input[name="beadType"][value="nano"]');
        const nano = await downloadPdf(page);
        const nanoPages = pdfPages(nano.buffer);
        assertA4(nanoPages, 'nano');
        assert(assertPitch(nanoPages[0], 7.37, 'nano') === 225, 'nano cell count');
        const nanoText = nanoPages.map((item) => item.text).join('\n');
        assert(nanoText.includes('2.6') || nanoText.includes('2.60'), 'nano pitch label chars=' + nanoText.length);
        assertLegend(nanoPages, heartCounts.rows, heartCounts.total, 'nano');
        assert(nano.event.params.board_size === '15x15', 'nano ga');
        saved.push(['heart-15-nano', nano.buffer]);
        report.push('heart nano 2.6mm pdf ok pitch=7.37');

        async function convertBoard(board, sample) {
            errors.length = 0;
            await page.goto(base + '/?board=' + board, { waitUntil: 'domcontentloaded' });
            await installCapture(page);
            await page.click('#toolPhoto');
            await page.click('[data-sample="' + sample + '"]');
            await page.waitForFunction(() => {
                const button = document.querySelector('#applyConvert');
                return button && !button.disabled;
            }, { timeout: 20000 });
            await page.click('#applyConvert');
            await page.waitForFunction(() => Number(document.querySelector('#countTotal').dataset.total) > 20, { timeout: 20000 });
            await page.click('#printPdfBtn');
            await page.waitForSelector('#printDialog[open]');
            const counts = await editorCounts(page);
            const pdf = await downloadPdf(page);
            assert(errors.length === 0, board + ' errors:\n' + errors.join('\n'));
            return { counts, pdf };
        }

        const large = await convertBoard(29, 'strawberry');
        const largePages = pdfPages(large.pdf.buffer);
        assertA4(largePages, '29');
        assert(large.counts.board === '29', '29 board');
        assert(assertPitch(largePages[0], 14.17, '29') === 29 * 29, '29 cell count ' + cellsOf(largePages[0], 14.17).length);
        assertLegend(largePages, large.counts.rows, large.counts.total, '29');
        assert(large.pdf.event.params.board_size === '29x29', '29 ga');
        assert(largePages.some((item) => item.text.includes('実寸ではありません')), '29 overview');
        saved.push(['board-29', large.pdf.buffer]);
        report.push('29x29 pdf ok pages=' + largePages.length + ' beads=' + large.counts.total + ' colors=' + large.counts.rows.length);

        const big = await convertBoard(58, 'bird');
        const bigPages = pdfPages(big.pdf.buffer);
        assertA4(bigPages, '58');
        assert(big.counts.board === '58', '58 board');
        assert(bigPages.length >= 4, '58 pages ' + bigPages.length);
        const joined = bigPages.map((item) => item.text).join('\n');
        assert(joined.includes('1/4（1行目・1列目）'), '58 missing 1/4 label\n' + joined.slice(0, 500));
        assert(joined.includes('2/4（1行目・2列目）'), '58 missing 2/4 label');
        assert(joined.includes('重ね'), '58 missing overlap note');
        assert(assertPitch(bigPages[0], 14.17, '58') > 100, '58 cells');
        assertLegend(bigPages, big.counts.rows, big.counts.total, '58');
        assert(big.pdf.event.params.board_size === '58x58', '58 ga');
        saved.push(['board-58', big.pdf.buffer]);
        report.push('58x58 pdf ok pages=' + bigPages.length + ' beads=' + big.counts.total);

        const cardCounts = {
            '/zuan': 51,
            '/christmas': 44,
            '/fuyu': 12,
            '/oshogatsu': 9,
            '/aquabeads': 4,
            '/perler': 4,
            '/nanobeads': 4,
            '/rittai': 3,
            '/oshare': 15,
            '/kantan': 15,
            '/kyoryu-umi': 15,
            '/sweets': 12,
            '/heisei-retro': 10,
            '/moji': 48,
            '/kisetsu': 10
        };
        const newPages = ['/oshare', '/kantan', '/kyoryu-umi', '/sweets', '/heisei-retro', '/moji', '/kisetsu'];
        for (const path of Object.keys(cardCounts)) {
            errors.length = 0;
            await page.goto(base + path, { waitUntil: 'domcontentloaded' });
            const found = await page.evaluate(() => ({
                cards: document.querySelectorAll('.pattern-card').length,
                prints: document.querySelectorAll('a.pattern-print').length
            }));
            assert(found.cards === cardCounts[path], path + ' cards ' + found.cards + ' != ' + cardCounts[path]);
            assert(found.prints === cardCounts[path], path + ' print buttons ' + found.prints);
            await new Promise((resolve) => setTimeout(resolve, 200));
            assert(errors.length === 0, path + ' errors:\n' + errors.join('\n'));
            report.push(path + ' cards ' + found.cards + ' match main');
        }

        for (const path of newPages) {
            errors.length = 0;
            await page.goto(base + path, { waitUntil: 'domcontentloaded' });
            const href = await page.$eval('a.pattern-print', (el) => el.getAttribute('href'));
            await page.goto(base + href, { waitUntil: 'domcontentloaded' });
            await installCapture(page);
            await page.waitForFunction(() => Number(document.querySelector('#countTotal').dataset.total) > 0, { timeout: 15000 });
            await page.waitForSelector('#printDialog[open]');
            const editor = await editorCounts(page);
            const pdf = await downloadPdf(page);
            const sheets = pdfPages(pdf.buffer);
            assertA4(sheets, path);
            const board = Number(editor.board);
            const cells = assertPitch(sheets[0], 14.17, path);
            if (board <= 29) assert(cells === board * board, path + ' cells ' + cells + ' board ' + board);
            assertLegend(sheets, editor.rows, editor.total, path);
            assert(pdf.event && pdf.event.params.board_size === board + 'x' + board, path + ' ga ' + JSON.stringify(pdf.event));
            assert(errors.length === 0, path + ' pdf errors:\n' + errors.join('\n'));
            report.push(path + ' card pdf ok board=' + board + ' beads=' + editor.total);
        }

        errors.length = 0;
        await page.goto(base + '/?name=HARU&pdf=1', { waitUntil: 'domcontentloaded' });
        await installCapture(page);
        await page.waitForFunction(() => {
            const total = document.querySelector('#countTotal');
            return total && Number(total.dataset.total) > 0 && document.querySelector('#printDialog[open]');
        }, { timeout: 15000 });
        const nameCounts = await editorCounts(page);
        const namePdf = await downloadPdf(page);
        const namePages = pdfPages(namePdf.buffer);
        assertA4(namePages, 'name');
        assert(nameCounts.board === '29', 'HARU board ' + nameCounts.board);
        assert(assertPitch(namePages[0], 14.17, 'name') === 29 * 29, 'name cells');
        assertLegend(namePages, nameCounts.rows, nameCounts.total, 'name');
        assert(namePages.map((item) => item.text).join('\n').includes('HARU'), 'name title');
        assert(namePdf.event && namePdf.event.params.board_size === '29x29', 'name ga');
        assert(errors.length === 0, 'name errors:\n' + errors.join('\n'));
        saved.push(['name-haru', namePdf.buffer]);
        report.push('name HARU pdf ok beads=' + nameCounts.total + ' board=29');

        const { writeFile, mkdir } = await import('node:fs/promises');
        await mkdir('/tmp/bead-pdfs', { recursive: true });
        for (const [name, buffer] of saved) {
            await writeFile('/tmp/bead-pdfs/' + name + '.pdf', buffer);
        }
        console.log(report.join('\n'));
        console.log('SAVED /tmp/bead-pdfs');
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
