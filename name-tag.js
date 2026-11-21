(function (root) {
    var KANA = {
        'あ': 'kana-a',
        'い': 'kana-i',
        'う': 'kana-u',
        'え': 'kana-e',
        'お': 'kana-o',
        'く': 'kana-ku',
        'し': 'kana-shi',
        'は': 'kana-ha',
        'ゆ': 'kana-yu',
        'ら': 'kana-ra',
        'る': 'kana-ru',
        'ん': 'kana-n'
    };

    function glyphId(ch) {
        if (/^[A-Za-z]$/.test(ch)) return 'font-' + ch.toLowerCase();
        if (/^[0-9]$/.test(ch)) return 'font-' + ch;
        return KANA[ch] || '';
    }

    function boardFor(width, height) {
        var sizes = [15, 20, 29, 58];
        for (var i = 0; i < sizes.length; i += 1) {
            if (width <= sizes[i] && height <= sizes[i]) return sizes[i];
        }
        return 0;
    }

    function composeName(text, patterns) {
        var byId = {};
        (patterns || []).forEach(function (item) {
            byId[item.id] = item;
        });
        var raw = String(text || '').replace(/[\s\u3000]+/g, '');
        if (!raw) return { error: '文字を入力してください' };
        var chars = Array.from(raw);
        if (chars.length > 8) return { error: '8文字までです' };
        var glyphs = [];
        for (var i = 0; i < chars.length; i += 1) {
            var id = glyphId(chars[i]);
            if (!id || !byId[id]) {
                return { error: '「' + chars[i] + '」はまだ字体がありません。アルファベット、数字、あいうえおくしはゆらるんが使えます' };
            }
            glyphs.push(byId[id]);
        }
        var gap = 1;
        var pad = 1;
        var width = pad * 2;
        var glyphH = 0;
        glyphs.forEach(function (glyph, index) {
            width += glyph.rows[0].length;
            if (index < glyphs.length - 1) width += gap;
            if (glyph.rows.length > glyphH) glyphH = glyph.rows.length;
        });
        var height = glyphH + pad * 2;
        var board = boardFor(width, height);
        if (!board) return { error: '長すぎます。文字を減らしてください' };
        var grid = [];
        for (var y = 0; y < height; y += 1) {
            var blank = [];
            for (var x = 0; x < width; x += 1) blank.push('a');
            grid.push(blank);
        }
        var cursor = pad;
        glyphs.forEach(function (glyph, index) {
            var glyphW = glyph.rows[0].length;
            var y0 = pad + (glyphH - glyph.rows.length);
            glyph.rows.forEach(function (row, gy) {
                for (var gx = 0; gx < row.length; gx += 1) {
                    if (row.charAt(gx) !== '.') grid[y0 + gy][cursor + gx] = 'N';
                }
            });
            cursor += glyphW;
            if (index < glyphs.length - 1) cursor += gap;
        });
        return {
            id: 'name-tag',
            title: raw,
            board: board,
            rows: grid.map(function (row) { return row.join(''); }),
            width: width,
            height: height
        };
    }

    root.BeadName = {
        composeName: composeName,
        glyphId: glyphId,
        KANA: KANA
    };
})(window);
