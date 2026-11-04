/* Animated GIF encoder with no outside libraries.
 * - One shared palette for the whole animation (median cut), so colors don't flicker.
 * - Optional Floyd-Steinberg dithering for smooth gradients.
 * - Transparency, looping and per-frame delays.
 * The encoder runs in a Web Worker (built from this same code) so the page stays responsive. */
(function () {
  "use strict";
  const GAS = window.GAS;

  /* Everything inside gifCore must be self-contained: it is also turned into worker source code. */
  function gifCore() {
    function ByteWriter() {
      let buf = new Uint8Array(1 << 16), n = 0;
      const ensure = (k) => {
        if (n + k <= buf.length) return;
        let len = buf.length * 2;
        while (len < n + k) len *= 2;
        const nb = new Uint8Array(len);
        nb.set(buf.subarray(0, n));
        buf = nb;
      };
      return {
        byte(b) { ensure(1); buf[n++] = b & 255; },
        word(w) { ensure(2); buf[n++] = w & 255; buf[n++] = (w >> 8) & 255; },
        bytes(arr) { ensure(arr.length); buf.set(arr, n); n += arr.length; },
        str(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); },
        result() { return buf.slice(0, n); },
      };
    }

    /* ---- palette: median cut over a 15-bit color histogram ---- */
    function buildPalette(frames, maxColors) {
      const counts = new Float64Array(32768), rs = new Float64Array(32768), gs = new Float64Array(32768), bs = new Float64Array(32768);
      let total = 0;
      for (const f of frames) total += f.length / 4;
      const stride = Math.max(1, Math.floor(total / 600000));
      for (const d of frames) {
        for (let i = 0; i < d.length; i += 4 * stride) {
          if (d[i + 3] < 128) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
          counts[k]++; rs[k] += r; gs[k] += g; bs[k] += b;
        }
      }
      const bins = [];
      for (let k = 0; k < 32768; k++) if (counts[k]) bins.push(k);
      if (!bins.length) return [[0, 0, 0]];
      const ch = (k, c) => (c === 0 ? k >> 10 : c === 1 ? (k >> 5) & 31 : k & 31);
      const makeBox = (list) => {
        let lo = [31, 31, 31], hi = [0, 0, 0], n = 0;
        for (const k of list) {
          n += counts[k];
          for (let c = 0; c < 3; c++) { const v = ch(k, c); if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; }
        }
        const ranges = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
        const axis = ranges.indexOf(Math.max(...ranges));
        return { list, n, axis, range: ranges[axis] };
      };
      const boxes = [makeBox(bins)];
      while (boxes.length < maxColors) {
        let best = -1, score = 0;
        boxes.forEach((b, i) => {
          if (b.list.length < 2 || b.range === 0) return;
          const s = b.range * Math.sqrt(b.n);
          if (s > score) { score = s; best = i; }
        });
        if (best < 0) break;
        const box = boxes[best];
        const ax = box.axis;
        box.list.sort((a, b) => ch(a, ax) - ch(b, ax));
        let acc = 0, cut = 1;
        for (let i = 0; i < box.list.length; i++) {
          acc += counts[box.list[i]];
          if (acc >= box.n / 2) { cut = Math.min(Math.max(1, i + 1), box.list.length - 1); break; }
        }
        boxes.splice(best, 1, makeBox(box.list.slice(0, cut)), makeBox(box.list.slice(cut)));
      }
      return boxes.map((b) => {
        let n = 0, r = 0, g = 0, bl = 0;
        for (const k of b.list) { n += counts[k]; r += rs[k]; g += gs[k]; bl += bs[k]; }
        return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)];
      });
    }

    function nearestFinder(palette, offset) {
      const cache = new Int16Array(32768).fill(-1);
      return (r, g, b) => {
        const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        let idx = cache[k];
        if (idx >= 0) return idx;
        let bd = Infinity;
        for (let i = 0; i < palette.length; i++) {
          const p = palette[i];
          const dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
          const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
          if (d < bd) { bd = d; idx = i; }
        }
        idx += offset;
        cache[k] = idx;
        return idx;
      };
    }

    function indexFrame(d, w, h, nearest, transparent, dither, palette, offset) {
      const out = new Uint8Array(w * h);
      if (!dither) {
        for (let i = 0, j = 0; j < out.length; i += 4, j++) {
          out[j] = transparent && d[i + 3] < 128 ? 0 : nearest(d[i], d[i + 1], d[i + 2]);
        }
        return out;
      }
      const err = new Float32Array((w + 2) * 3 * 2);
      for (let y = 0; y < h; y++) {
        const cur = (y & 1) * (w + 2) * 3, nxt = ((y + 1) & 1) * (w + 2) * 3;
        err.fill(0, nxt, nxt + (w + 2) * 3);
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4, j = y * w + x;
          if (transparent && d[i + 3] < 128) { out[j] = 0; continue; }
          const e = cur + (x + 1) * 3;
          const r = Math.max(0, Math.min(255, d[i] + err[e]));
          const g = Math.max(0, Math.min(255, d[i + 1] + err[e + 1]));
          const b = Math.max(0, Math.min(255, d[i + 2] + err[e + 2]));
          const idx = nearest(r, g, b);
          out[j] = idx;
          const p = palette[idx - offset];
          const er = r - p[0], eg = g - p[1], eb = b - p[2];
          const spread = (base, k) => { err[base] += er * k; err[base + 1] += eg * k; err[base + 2] += eb * k; };
          spread(e + 3, 7 / 16);
          spread(nxt + x * 3, 3 / 16);
          spread(nxt + (x + 1) * 3, 5 / 16);
          spread(nxt + (x + 2) * 3, 1 / 16);
        }
      }
      return out;
    }

    function lzw(out, indices, minCodeSize) {
      out.byte(minCodeSize);
      const clearCode = 1 << minCodeSize, eoi = clearCode + 1;
      let codeSize = minCodeSize + 1, next = eoi + 1;
      let dict = new Map();
      const block = new Uint8Array(255);
      let bl = 0, cur = 0, shift = 0;
      const flushByte = (b) => { block[bl++] = b; if (bl === 255) { out.byte(255); out.bytes(block); bl = 0; } };
      const emit = (code) => {
        cur |= code << shift;
        shift += codeSize;
        while (shift >= 8) { flushByte(cur & 255); cur >>>= 8; shift -= 8; }
      };
      emit(clearCode);
      let prefix = indices[0];
      for (let i = 1; i < indices.length; i++) {
        const k = indices[i];
        const key = (prefix << 8) | k;
        const found = dict.get(key);
        if (found !== undefined) { prefix = found; continue; }
        emit(prefix);
        if (next === 4096) {
          emit(clearCode);
          dict = new Map();
          codeSize = minCodeSize + 1;
          next = eoi + 1;
        } else {
          if (next >= 1 << codeSize) codeSize++;
          dict.set(key, next++);
        }
        prefix = k;
      }
      emit(prefix);
      emit(eoi);
      if (shift > 0) flushByte(cur & 255);
      if (bl) { out.byte(bl); out.bytes(block.subarray(0, bl)); }
      out.byte(0);
    }

    /* frames: [Uint8ClampedArray RGBA], delays: [centiseconds], loop: 0 = forever, n = repeat n times, -1 = play once */
    function encode(frames, delays, w, h, opts, progress) {
      const transparent = !!opts.transparent;
      const maxColors = transparent ? 255 : 256;
      const palette = buildPalette(frames, maxColors);
      const offset = transparent ? 1 : 0;
      const full = transparent ? [[0, 0, 0]].concat(palette) : palette.slice();
      let bits = 1;
      while (1 << bits < full.length) bits++;
      bits = Math.max(bits, 2);
      while (full.length < 1 << bits) full.push([0, 0, 0]);
      const nearest = nearestFinder(palette, offset);

      const out = ByteWriter();
      out.str("GIF89a");
      out.word(w);
      out.word(h);
      out.byte(0x80 | ((bits - 1) << 4) | (bits - 1));
      out.byte(0);
      out.byte(0);
      for (const c of full) { out.byte(c[0]); out.byte(c[1]); out.byte(c[2]); }
      if (opts.loop !== -1) {
        out.byte(0x21); out.byte(0xff); out.byte(11); out.str("NETSCAPE2.0");
        out.byte(3); out.byte(1); out.word(opts.loop || 0); out.byte(0);
      }
      for (let f = 0; f < frames.length; f++) {
        const idx = indexFrame(frames[f], w, h, nearest, transparent, !!opts.dither, palette, offset);
        out.byte(0x21); out.byte(0xf9); out.byte(4);
        out.byte(((transparent ? 2 : 1) << 2) | (transparent ? 1 : 0));
        out.word(Math.max(2, delays[f] | 0));
        out.byte(0);
        out.byte(0);
        out.byte(0x2c); out.word(0); out.word(0); out.word(w); out.word(h); out.byte(0);
        lzw(out, idx, bits);
        if (progress) progress((f + 1) / frames.length);
      }
      out.byte(0x3b);
      return out.result();
    }

    return { encode };
  }

  const core = gifCore();

  /* Encode in a worker when possible. frames: array of ImageData-like {data}. Resolves to a Blob. */
  function encode(frames, delays, w, h, opts, onProgress) {
    const datas = frames.map((f) => f.data || f);
    return new Promise((resolve, reject) => {
      let worker = null, url = null;
      try {
        const src = `const core = (${gifCore.toString()})();
          self.onmessage = (e) => {
            const { frames, delays, w, h, opts } = e.data;
            try {
              const bytes = core.encode(frames, delays, w, h, opts, (p) => self.postMessage({ progress: p }));
              self.postMessage({ bytes }, [bytes.buffer]);
            } catch (err) { self.postMessage({ error: String(err && err.message || err) }); }
          };`;
        url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
        worker = new Worker(url);
      } catch {
        worker = null;
      }
      if (!worker) {
        // Fallback: encode right here (the page pauses briefly).
        setTimeout(() => {
          try { resolve(new Blob([core.encode(datas, delays, w, h, opts, onProgress)], { type: "image/gif" })); }
          catch (err) { reject(err); }
        }, 30);
        return;
      }
      worker.onmessage = (e) => {
        if (e.data.progress != null) { if (onProgress) onProgress(e.data.progress); return; }
        worker.terminate();
        URL.revokeObjectURL(url);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(new Blob([e.data.bytes], { type: "image/gif" }));
      };
      worker.onerror = (err) => {
        worker.terminate();
        URL.revokeObjectURL(url);
        // Some browsers block blob workers: fall back to the main thread.
        try { resolve(new Blob([core.encode(datas, delays, w, h, opts, onProgress)], { type: "image/gif" })); }
        catch (e2) { reject(e2 || err); }
      };
      const copies = datas.map((d) => new Uint8ClampedArray(d));
      worker.postMessage({ frames: copies, delays, w, h, opts }, copies.map((d) => d.buffer));
    });
  }

  GAS.gif = { encode, core };
})();
