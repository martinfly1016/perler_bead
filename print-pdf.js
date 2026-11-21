'use strict';

// Client-side print sheet. Cells are the real bead pitch so the page can sit
// under a clear pegboard. Pitch sources, checked against public listings:
// - アイロンビーズ / パーラービーズ: 5.0mm. カワダ単色の販売説明は「約5mm」
//   （ユザワヤ パーラービーズ単色）。Perler の大きい四角プレートは 29×29 で
//   一辺 5.7 インチ。29 × 5mm = 145mm = 5.71 インチで、公開の外形と一致する。
// - ナノビーズ: 2.6mm. カワダ単色 品番 80-15926 は φ2.6mm × H2.8mm。
// - アクアビーズ: 5.0mm. 公式ページに直径の図面は見当たらず、販売ページの
//   まるビーズが 5mm 球（ヨドバシ AQ-256、ジグソークラブ AQ-113）。
//   隣の粒と接して水で付くので、中心間隔もその直径に合わせている。
// Points use 1mm = 72/25.4pt, rounded to 0.01pt the way PDF viewers do.
// 5mm is 14.17pt. 2.6mm is 7.37pt. A 5cm ruler is 141.73pt.

var BEAD_TYPES = {
    standard: {
        id: 'standard',
        pitchMm: 5,
        label: 'アイロンビーズ / パーラービーズ',
        note: 'マスは5mmです。15・20・29・58のボードは、最初はこの5mmが選ばれます。'
    },
    nano: {
        id: 'nano',
        pitchMm: 2.6,
        label: 'ナノビーズ',
        note: 'マスは2.6mmです。カワダのナノビーズ単色はφ2.6mmです。5mmのプレートには合いません。'
    },
    aqua: {
        id: 'aqua',
        pitchMm: 5,
        label: 'アクアビーズ',
        note: 'マスは5mmです。まるビーズは販売ページで5mm球とされています。トレイの下に敷いて使います。'
    }
};

var PAGE_MM_W = 210;
var PAGE_MM_H = 297;
var MARGIN_X_MM = 12;
var GRID_TOP_MM = 36;
var GRID_BOTTOM_MM = 270;
var LEGEND_ROW_MM = 5.6;
var MM_TO_PT = 72 / 25.4;

function mm(value) {
    return Math.round(value * MM_TO_PT * 100) / 100;
}

function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length !== 6) return [200, 200, 200];
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16)
    ];
}

function mixWhite(hex, whiteRatio) {
    var rgb = hexToRgb(hex);
    return rgb.map(function (channel) {
        return Math.round(channel * (1 - whiteRatio) + 255 * whiteRatio);
    });
}

function luminance(rgb) {
    var lin = rgb.map(function (channel) {
        var value = channel / 255;
        if (value <= 0.04045) return value / 12.92;
        return Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function legendBlockMm(colorCount) {
    var columns = colorCount > 6 ? 2 : 1;
    var lines = Math.ceil(Math.max(colorCount, 1) / columns);
    return 6 + lines * LEGEND_ROW_MM + 12;
}

function axisSpans(total, fit, overlap) {
    if (total <= fit) {
        return [{ start: 0, end: total, before: 0, after: 0 }];
    }
    var step = Math.max(1, fit - overlap);
    var spans = [];
    var start = 0;
    while (start < total) {
        var end = Math.min(total, start + fit);
        spans.push({ start: start, end: end, before: 0, after: 0 });
        if (end >= total) break;
        start += step;
    }
    spans.forEach(function (span, index) {
        if (index > 0) span.before = spans[index - 1].end - span.start;
        if (index < spans.length - 1) span.after = span.end - spans[index + 1].start;
    });
    return spans;
}

function planSheets(snapshot, pitchMm) {
    var pitchPt = mm(pitchMm);
    var board = snapshot.boardSize;
    var availW = mm(PAGE_MM_W - MARGIN_X_MM * 2);
    var availH = mm(GRID_BOTTOM_MM - GRID_TOP_MM);
    var gridPt = board * pitchPt;
    var legendPt = mm(legendBlockMm(snapshot.rows.length));
    var samePage = gridPt <= availW + 0.05 && gridPt + mm(8) + legendPt <= availH + 0.05;
    var fitX = Math.max(1, Math.floor((availW + 0.05) / pitchPt));
    var fitY = Math.max(1, Math.floor((availH + 0.05) / pitchPt));
    var overlap = Math.min(fitX - 1, fitY - 1, Math.max(1, Math.round(mm(10) / pitchPt)));
    var xSpans = samePage ? axisSpans(board, board, 0) : axisSpans(board, fitX, overlap);
    var ySpans = samePage ? axisSpans(board, board, 0) : axisSpans(board, fitY, overlap);
    var tiles = [];
    ySpans.forEach(function (spanY, rowIndex) {
        xSpans.forEach(function (spanX, colIndex) {
            tiles.push({
                x: spanX,
                y: spanY,
                col: colIndex + 1,
                row: rowIndex + 1
            });
        });
    });
    return {
        pitchPt: pitchPt,
        samePage: samePage,
        tiles: tiles,
        showSeam: pitchMm === 5
    };
}

function overlapNote(tile) {
    var counts = [tile.x.before, tile.x.after, tile.y.before, tile.y.after].filter(function (count) {
        return count > 0;
    });
    if (!counts.length) return '';
    var same = counts.every(function (count) { return count === counts[0]; });
    if (same) return '点線の外側' + counts[0] + 'マスは、隣のページと重ねて合わせてください。';
    return '点線の外側は、隣のページと重ねて合わせてください。';
}

function mountFont(doc) {
    var b64 = window.BEAD_PRINT_FONT_B64;
    if (!b64) throw new Error('font missing');
    doc.addFileToVFS('NotoSansJP-Regular.ttf', b64);
    doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
}

function useFont(doc, name, size, rgb) {
    doc.setFont(name, 'normal');
    doc.setFontSize(size);
    if (rgb) doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function drawRuler(doc, x, y) {
    var length = mm(50);
    doc.setFillColor(40, 32, 38);
    doc.rect(x, y, length, 0.7, 'F');
    var step;
    for (step = 0; step <= 50; step += 1) {
        var tick = step % 10 === 0 ? mm(3.1) : step % 5 === 0 ? mm(2.1) : mm(1.15);
        var tickX = x + mm(step) - 0.3;
        doc.rect(tickX, y, 0.6, tick, 'F');
    }
    useFont(doc, 'NotoSansJP', 8, [40, 32, 38]);
    var caption = '5cm。刷ったあと、定規でこの長さを確かめてください。';
    var captionX = x + length + mm(3);
    var maxWidth = mm(PAGE_MM_W - MARGIN_X_MM) - captionX;
    if (doc.getTextWidth(caption) > maxWidth) caption = '5cm（定規で確認）';
    doc.text(caption, captionX, y + 2.4);
}

function drawFooter(doc, title, pageLabel, rangeLabel) {
    var left = mm(MARGIN_X_MM);
    var right = mm(PAGE_MM_W - MARGIN_X_MM);
    var y1 = mm(279);
    var y2 = mm(284.2);
    doc.setDrawColor(231, 168, 194);
    doc.setLineWidth(0.6);
    doc.line(left, mm(275.5), right, mm(275.5));
    useFont(doc, 'NotoSansJP', 8, [74, 58, 68]);
    var titleSize = 8;
    doc.setFontSize(titleSize);
    while (titleSize > 6.5 && doc.getTextWidth(title) > mm(110)) {
        titleSize -= 0.5;
        doc.setFontSize(titleSize);
    }
    doc.text(title, left, y1);
    useFont(doc, 'helvetica', 8, [74, 58, 68]);
    doc.text('https://beads.mojimoon.com', right, y1, { align: 'right' });
    useFont(doc, 'NotoSansJP', 8, [90, 70, 80]);
    doc.text(pageLabel, left, y2);
    if (rangeLabel) doc.text(rangeLabel, right, y2, { align: 'right' });
}

function drawSheetHeader(doc, title, instruction, beadLine, extra, withRuler) {
    var left = mm(MARGIN_X_MM);
    useFont(doc, 'NotoSansJP', 12, [74, 42, 58]);
    var titleSize = 12;
    doc.setFontSize(titleSize);
    while (titleSize > 8 && doc.getTextWidth(title) > mm(PAGE_MM_W - MARGIN_X_MM * 2)) {
        titleSize -= 0.5;
        doc.setFontSize(titleSize);
    }
    doc.text(title, left, mm(11));
    useFont(doc, 'NotoSansJP', 8.5, [176, 52, 96]);
    doc.text(instruction, left, mm(16));
    useFont(doc, 'NotoSansJP', 8.5, [74, 58, 68]);
    doc.text(beadLine, left, mm(20.4));
    if (extra) {
        useFont(doc, 'NotoSansJP', 8, [90, 70, 80]);
        doc.text(extra, left, mm(24.4));
    }
    if (withRuler) drawRuler(doc, left, mm(28.8));
}

function symbolSize(doc, pitchPt) {
    var size = Math.min(8, pitchPt * 0.7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    while (size > 3 && doc.getTextWidth('88') > pitchPt * 0.82) {
        size = Math.round((size - 0.2) * 10) / 10;
        doc.setFontSize(size);
    }
    return size;
}

function drawCropMark(doc, x, y, xSign, ySign) {
    var gap = 2.2;
    var len = 7;
    doc.setDrawColor(50, 40, 46);
    doc.setLineWidth(0.7);
    doc.setLineDashPattern([], 0);
    doc.line(x + xSign * gap, y, x + xSign * (gap + len), y);
    doc.line(x, y + ySign * gap, x, y + ySign * (gap + len));
}

function drawGridPage(doc, snapshot, plan, tile, type, pageLabel) {
    var pitch = plan.pitchPt;
    var left = mm(MARGIN_X_MM);
    var top = mm(GRID_TOP_MM);
    var cols = tile.x.end - tile.x.start;
    var rows = tile.y.end - tile.y.start;
    var title = snapshot.title || 'アイロンビーズ図案';
    drawSheetHeader(
        doc,
        title + '  ' + snapshot.boardSize + '×' + snapshot.boardSize,
        '印刷は「実際のサイズ / 100%」。拡大・縮小・用紙に合わせるはオフ。',
        type.label + '・ピッチ ' + type.pitchMm + 'mm',
        overlapNote(tile),
        true
    );

    var numberByHex = new Map();
    snapshot.rows.forEach(function (row) {
        numberByHex.set(row.hex, row.number);
    });
    var filled = new Map();
    snapshot.cells.forEach(function (cell) {
        filled.set(cell[0] + ',' + cell[1], cell[2]);
    });

    var yIndex;
    var xIndex;
    for (yIndex = 0; yIndex < rows; yIndex += 1) {
        for (xIndex = 0; xIndex < cols; xIndex += 1) {
            var boardX = tile.x.start + xIndex;
            var boardY = tile.y.start + yIndex;
            var hex = filled.get(boardX + ',' + boardY);
            var fill = hex ? mixWhite(hex, 0.55) : [255, 255, 255];
            doc.setFillColor(fill[0], fill[1], fill[2]);
            doc.rect(left + xIndex * pitch, top + yIndex * pitch, pitch, pitch, 'F');
        }
    }

    doc.setDrawColor(196, 186, 190);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([], 0);
    for (xIndex = 0; xIndex <= cols; xIndex += 1) {
        var xLine = left + xIndex * pitch;
        doc.line(xLine, top, xLine, top + rows * pitch);
    }
    for (yIndex = 0; yIndex <= rows; yIndex += 1) {
        var yLine = top + yIndex * pitch;
        doc.line(left, yLine, left + cols * pitch, yLine);
    }

    if (plan.showSeam) {
        doc.setDrawColor(229, 119, 159);
        doc.setLineWidth(0.9);
        for (xIndex = 0; xIndex <= cols; xIndex += 1) {
            if ((tile.x.start + xIndex) % 29 !== 0) continue;
            if (xIndex === 0 || xIndex === cols) continue;
            var seamX = left + xIndex * pitch;
            doc.line(seamX, top, seamX, top + rows * pitch);
        }
        for (yIndex = 0; yIndex <= rows; yIndex += 1) {
            if ((tile.y.start + yIndex) % 29 !== 0) continue;
            if (yIndex === 0 || yIndex === rows) continue;
            var seamY = top + yIndex * pitch;
            doc.line(left, seamY, left + cols * pitch, seamY);
        }
    }

    var glyph = symbolSize(doc, pitch);
    for (yIndex = 0; yIndex < rows; yIndex += 1) {
        for (xIndex = 0; xIndex < cols; xIndex += 1) {
            var cellX = tile.x.start + xIndex;
            var cellY = tile.y.start + yIndex;
            var color = filled.get(cellX + ',' + cellY);
            if (!color) continue;
            var num = numberByHex.get(color);
            if (!num) continue;
            var inkRgb = luminance(mixWhite(color, 0.55)) > 0.22 ? [24, 18, 22] : [255, 255, 255];
            useFont(doc, 'helvetica', glyph, inkRgb);
            doc.text(String(num), left + (xIndex + 0.5) * pitch, top + (yIndex + 0.5) * pitch, {
                align: 'center',
                baseline: 'middle'
            });
        }
    }

    doc.setDrawColor(90, 60, 72);
    doc.setLineWidth(1);
    doc.setLineDashPattern([], 0);
    doc.rect(left, top, cols * pitch, rows * pitch);

    doc.setDrawColor(198, 72, 112);
    doc.setLineWidth(0.8);
    doc.setLineDashPattern([2.2, 1.6], 0);
    if (tile.x.before > 0) {
        var leftMark = left + tile.x.before * pitch;
        doc.line(leftMark, top, leftMark, top + rows * pitch);
    }
    if (tile.x.after > 0) {
        var rightMark = left + (cols - tile.x.after) * pitch;
        doc.line(rightMark, top, rightMark, top + rows * pitch);
    }
    if (tile.y.before > 0) {
        var topMark = top + tile.y.before * pitch;
        doc.line(left, topMark, left + cols * pitch, topMark);
    }
    if (tile.y.after > 0) {
        var bottomMark = top + (rows - tile.y.after) * pitch;
        doc.line(left, bottomMark, left + cols * pitch, bottomMark);
    }
    doc.setLineDashPattern([], 0);

    drawCropMark(doc, left, top, -1, -1);
    drawCropMark(doc, left + cols * pitch, top, 1, -1);
    drawCropMark(doc, left, top + rows * pitch, -1, 1);
    drawCropMark(doc, left + cols * pitch, top + rows * pitch, 1, 1);

    var range = '列' + (tile.x.start + 1) + '-' + tile.x.end + '  行' + (tile.y.start + 1) + '-' + tile.y.end;
    drawFooter(doc, title, pageLabel, range);

    if (!plan.samePage) return;
    drawLegend(doc, snapshot, left, top + rows * pitch + mm(8), mm(PAGE_MM_W - MARGIN_X_MM * 2));
}

function drawLegend(doc, snapshot, x, y, width) {
    var rows = snapshot.rows;
    var columns = rows.length > 6 ? 2 : 1;
    var lines = Math.ceil(Math.max(rows.length, 1) / columns);
    var colW = width / columns;
    useFont(doc, 'NotoSansJP', 11, [74, 42, 58]);
    doc.text('色と個数', x, y);
    var listTop = y + mm(6);
    rows.forEach(function (row, index) {
        var col = Math.floor(index / lines);
        var line = index % lines;
        var cx = x + col * colW;
        var baseline = listTop + line * mm(LEGEND_ROW_MM);
        var sw = mm(3.6);
        var rgb = hexToRgb(row.hex);
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.setDrawColor(90, 70, 80);
        doc.setLineWidth(0.4);
        doc.rect(cx, baseline - mm(3.15), sw, sw, 'FD');
        useFont(doc, 'NotoSansJP', 9, [32, 24, 30]);
        doc.text(row.number + '  ' + row.name + '  ' + row.count, cx + sw + mm(1.5), baseline);
    });
    var foot = listTop + lines * mm(LEGEND_ROW_MM) + mm(1.2);
    useFont(doc, 'NotoSansJP', 10, [32, 24, 30]);
    doc.text('合計 ' + snapshot.total + '粒・' + rows.length + '色', x, foot);
    useFont(doc, 'NotoSansJP', 8, [110, 86, 96]);
    doc.text('色名は一般的な呼び方です。メーカーの色番号ではありません。', x, foot + mm(4.6));
}

function drawLegendPage(doc, snapshot, type) {
    var title = snapshot.title || 'アイロンビーズ図案';
    drawSheetHeader(
        doc,
        title + '  色と個数',
        '印刷は「実際のサイズ / 100%」。番号は図案ページのマスと同じです。',
        type.label + '・ピッチ ' + type.pitchMm + 'mm',
        '',
        true
    );
    drawLegend(doc, snapshot, mm(MARGIN_X_MM), mm(GRID_TOP_MM), mm(PAGE_MM_W - MARGIN_X_MM * 2));
    drawFooter(doc, title, '色と個数', '合計 ' + snapshot.total + '粒');
}

function drawOverviewPage(doc, snapshot, type) {
    var title = snapshot.title || 'アイロンビーズ図案';
    drawSheetHeader(
        doc,
        title + '  全体の見本',
        'このページは縮小です。実寸ではありません。敷くときは前のページを100%で印刷します。',
        type.label + '・図案は ' + snapshot.boardSize + '×' + snapshot.boardSize,
        '',
        false
    );
    var boxX = mm(16);
    var boxY = mm(32);
    var boxW = mm(178);
    var boxH = mm(220);
    var cell = Math.min(boxW / snapshot.boardSize, boxH / snapshot.boardSize);
    cell = Math.round(cell * 100) / 100;
    var originX = boxX + (boxW - cell * snapshot.boardSize) / 2;
    var originY = boxY;
    var yIndex;
    var xIndex;
    for (yIndex = 0; yIndex < snapshot.boardSize; yIndex += 1) {
        for (xIndex = 0; xIndex < snapshot.boardSize; xIndex += 1) {
            doc.setFillColor(247, 241, 243);
            doc.rect(originX + xIndex * cell, originY + yIndex * cell, cell, cell, 'F');
        }
    }
    snapshot.cells.forEach(function (item) {
        var rgb = hexToRgb(item[2]);
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.rect(originX + item[0] * cell, originY + item[1] * cell, cell, cell, 'F');
    });
    doc.setDrawColor(229, 119, 159);
    doc.setLineWidth(1);
    doc.rect(originX, originY, snapshot.boardSize * cell, snapshot.boardSize * cell);
    useFont(doc, 'NotoSansJP', 8, [110, 86, 96]);
    doc.text('色は画面の一般的な色名に近いものです。粒の位置だけを実物に合わせてください。', mm(MARGIN_X_MM), originY + snapshot.boardSize * cell + mm(6));
    drawFooter(doc, title, '全体の見本（縮小）', snapshot.boardSize + '×' + snapshot.boardSize);
}

function buildPrintPdf(snapshot, type, withOverview) {
    var JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) throw new Error('jspdf missing');
    var doc = new JsPDF({
        unit: 'pt',
        format: [mm(PAGE_MM_W), mm(PAGE_MM_H)],
        orientation: 'portrait',
        compress: true
    });
    mountFont(doc);
    var plan = planSheets(snapshot, type.pitchMm);
    var tileCount = plan.tiles.length;
    plan.tiles.forEach(function (tile, index) {
        if (index > 0) doc.addPage([mm(PAGE_MM_W), mm(PAGE_MM_H)], 'portrait');
        var label = (index + 1) + '/' + tileCount + '（' + tile.row + '行目・' + tile.col + '列目）';
        drawGridPage(doc, snapshot, plan, tile, type, label);
    });
    if (!plan.samePage) {
        doc.addPage([mm(PAGE_MM_W), mm(PAGE_MM_H)], 'portrait');
        drawLegendPage(doc, snapshot, type);
    }
    if (withOverview) {
        doc.addPage([mm(PAGE_MM_W), mm(PAGE_MM_H)], 'portrait');
        drawOverviewPage(doc, snapshot, type);
    }
    try {
        doc.setProperties({
            title: (snapshot.title || 'アイロンビーズ図案') + ' 印刷用PDF',
            creator: 'MojiMoon Beads',
            subject: type.label + ' ' + type.pitchMm + 'mm'
        });
    } catch (err) {
        // Metadata must not block the download.
    }
    return doc;
}

function pdfFileName(snapshot, type) {
    var pitch = String(type.pitchMm).replace('.', 'p');
    return 'mojimoon-beads-' + snapshot.boardSize + 'x' + snapshot.boardSize + '-' + pitch + 'mm.pdf';
}

function savePdf(doc, filename) {
    var buffer = doc.output('arraybuffer');
    if (typeof window.__capturePdf === 'function') window.__capturePdf(buffer, filename);
    var blob = new Blob([buffer], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

function readBeadChoice() {
    var chosen = document.querySelector('input[name="beadType"]:checked');
    var id = chosen ? chosen.value : 'standard';
    return BEAD_TYPES[id] || BEAD_TYPES.standard;
}

function applyBeadDefault() {
    var params = new URLSearchParams(location.search);
    var fromQuery = params.get('bead');
    var id = BEAD_TYPES[fromQuery] ? fromQuery : window.BeadEditor.presetBead(window.BeadEditor.snapshot().boardSize);
    var input = document.querySelector('input[name="beadType"][value="' + id + '"]');
    if (input) input.checked = true;
    var note = document.getElementById('printNote');
    var type = BEAD_TYPES[id];
    if (note && type) note.textContent = type.note;
}

function downloadFromDialog() {
    var button = document.getElementById('printDownload');
    var snapshot = window.BeadEditor.snapshot();
    if (!snapshot.total) {
        window.BeadEditor.flashStatus('ビーズを置いてから、印刷用PDFを作ってください。');
        return;
    }
    var type = readBeadChoice();
    var overview = document.getElementById('printOverview');
    var withOverview = !overview || overview.checked;
    button.disabled = true;
    button.textContent = '作成しています…';
    setTimeout(function () {
        try {
            var doc = buildPrintPdf(snapshot, type, withOverview);
            savePdf(doc, pdfFileName(snapshot, type));
            window.BeadEditor.trackEvent('pdf_export', {
                board_size: snapshot.boardSize + 'x' + snapshot.boardSize,
                bead_type: type.id
            });
            window.BeadEditor.flashStatus('印刷用PDFを保存しました。印刷は実際のサイズ（100%）にしてください。');
        } catch (err) {
            window.BeadEditor.flashStatus('PDFを作れませんでした。ページを読み直して、もう一度試してください。');
        } finally {
            button.disabled = false;
            button.textContent = 'PDFをダウンロード';
        }
    }, 30);
}

function openPrintDialog() {
    var dialog = document.getElementById('printDialog');
    if (!dialog || !window.BeadEditor) return;
    applyBeadDefault();
    if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
    } else {
        dialog.setAttribute('open', '');
    }
}

function initPrintPdf() {
    var openButton = document.getElementById('printPdfBtn');
    var dialog = document.getElementById('printDialog');
    var closeButton = document.getElementById('printClose');
    var downloadButton = document.getElementById('printDownload');
    if (!openButton || !dialog || !downloadButton || !window.BeadEditor) return;

    openButton.addEventListener('click', openPrintDialog);
    downloadButton.addEventListener('click', downloadFromDialog);
    if (closeButton) {
        closeButton.addEventListener('click', function () {
            if (typeof dialog.close === 'function') dialog.close();
            else dialog.removeAttribute('open');
        });
    }
    dialog.addEventListener('change', function (event) {
        if (!event.target || event.target.name !== 'beadType') return;
        var note = document.getElementById('printNote');
        var type = BEAD_TYPES[event.target.value];
        if (note && type) note.textContent = type.note;
    });
    dialog.addEventListener('cancel', function (event) {
        event.preventDefault();
        if (typeof dialog.close === 'function') dialog.close();
    });

    var autoOpened = false;
    window.BeadPrint = {
        onEditorReady: function () {
            if (autoOpened) return;
            if (new URLSearchParams(location.search).get('pdf') !== '1') return;
            autoOpened = true;
            openPrintDialog();
        }
    };
    var launch = new URLSearchParams(location.search);
    var waitsForGrid = launch.get('pattern') || launch.has('name');
    if (launch.get('pdf') === '1' && !waitsForGrid) {
        autoOpened = true;
        openPrintDialog();
    }
}

initPrintPdf();
