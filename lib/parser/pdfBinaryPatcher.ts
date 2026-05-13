/**
 * Pre-processes Bangladesh Election Commission PDF binaries to fix incorrect
 * ToUnicode CMap entries in the embedded Bijoy Bengali font (OZHNWW+Bangla).
 *
 * Root cause: The font's ToUnicode table maps CID 207 (0x00CF) to ো (U+09CB)
 * but the glyph is actually the pre-base visual form of ে (U+09C7). This
 * causes pdfjs-dist to emit ি for every instance of ে, making names like
 * বেগম appear as বিগম in extracted text.
 *
 * Strategy: decompress each FlateDecode stream in the PDF, check whether it
 * is a ToUnicode CMap (beginbfchar marker), patch the offending entries in
 * place, recompress, and update the Length entry in the stream dictionary.
 *
 * Falls back to the original ArrayBuffer on any error so the application
 * continues to work even if patching fails.
 */

// CID corrections for ToUnicode CMap entries in font OZHNWW+Bangla.
// Keys: zero-padded 4-digit uppercase hex CID.
// Values: concatenated Unicode hex codepoints (no spaces).
const TOUNICODE_CORRECTIONS: Record<string, string> = {
  // CID 207 (0x00CF): ToUnicode says ো (U+09CB) — actual glyph is the pre-base
  // visual ে (U+09C7). Most impactful: fixes বেগম→বিগম, বেসরকারী, কেরানীগঞ্জ, etc.
  "00CF": "09C7",

  // CID 253 (0x00FD): ToUnicode says ঞ (U+099E) — actual glyph is conjunct
  // ঞ্জ (U+099E U+09CD U+099C). Fixes কেরানীগঞ্জ losing its trailing জ.
  "00FD": "099E09CD099C",
};

// ---------------------------------------------------------------------------
// Zlib helpers — use the native CompressionStream / DecompressionStream APIs
// which are available in Chrome 80+, Firefox 113+, Safari 16.4+.
// ---------------------------------------------------------------------------

async function zlibDecompress(data: Uint8Array): Promise<Uint8Array> {
  // PDF FlateDecode is raw deflate (no zlib header in some cases) or zlib.
  // The DecompressionStream 'deflate' format handles zlib (with header).
  // 'deflate-raw' handles raw deflate.  We try zlib first, then raw.
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();

      writer.write(data as unknown as ArrayBuffer);
      writer.close();

      const chunks: Uint8Array[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as Uint8Array);
      }

      const total = chunks.reduce((s, c) => s + c.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      return out;
    } catch {
      // try the other format
    }
  }
  throw new Error("Could not decompress stream with either deflate format");
}

async function zlibCompress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  writer.write(data as unknown as ArrayBuffer);
  writer.close();

  const chunks: Uint8Array[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array);
  }

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// ---------------------------------------------------------------------------
// Patch a single decompressed CMap stream string
// ---------------------------------------------------------------------------

function patchCmapContent(content: string): { patched: string; changed: boolean } {
  let result = content;
  let changed = false;

  for (const [cidHex, correctHex] of Object.entries(TOUNICODE_CORRECTIONS)) {
    // CMap entries look like: <00CF> <09CB>
    // We replace any occurrence of <CID> <WRONG> with <CID> <CORRECT>.
    // We don't know the wrong value, so we replace any <CID> <????> pattern.
    // Case-insensitive: CMaps may use <00CF> or <00cf>
    const re = new RegExp(`<${cidHex}>\\s+<[0-9A-Fa-f]+>`, "gi");
    const upperCid = cidHex.toUpperCase();
    const upperVal = correctHex.toUpperCase();
    const replacement = `<${upperCid}> <${upperVal}>`;
    const next = result.replace(re, replacement);
    if (next !== result) {
      result = next;
      changed = true;
    }
  }

  return { patched: result, changed };
}

// ---------------------------------------------------------------------------
// PDF binary helpers
// ---------------------------------------------------------------------------

const ENC = new TextEncoder();
const DEC = new TextDecoder("latin1"); // latin1 preserves byte values 0-255

/** Convert Uint8Array to a string using latin1 (byte-safe). */
function bytesToStr(bytes: Uint8Array): string {
  return DEC.decode(bytes);
}

/** Convert a latin1 string back to Uint8Array. */
function strToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// ---------------------------------------------------------------------------
// Main patching logic
// ---------------------------------------------------------------------------

/**
 * Given a raw PDF ArrayBuffer, find all FlateDecode streams, decompress them,
 * patch ToUnicode CMap entries, recompress, and return the modified buffer.
 * Returns the original buffer unchanged if any error occurs.
 */
export async function patchPdfBinary(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    return await _patchPdfBinary(buffer);
  } catch {
    // Silent fallback — pdfjs will still parse the file, just with wrong mappings
    return buffer;
  }
}

async function _patchPdfBinary(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const raw = new Uint8Array(buffer);
  const pdfStr = bytesToStr(raw);

  // Locate all `stream` … `endstream` boundaries.
  // We search for FlateDecode streams only.
  const streamRe = /<<([^>]*(?:>>(?!)[^>]*)*)>>\s*stream\r?\n/g;
  const segments: Array<{
    dictStart: number;
    dictEnd: number;
    dataStart: number;
    dataEnd: number;
    dict: string;
  }> = [];

  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(pdfStr)) !== null) {
    const dict = m[1];
    if (!/FlateDecode/i.test(dict)) continue;

    const dataStart = m.index + m[0].length;
    const endStream = pdfStr.indexOf("endstream", dataStart);
    if (endStream === -1) continue;

    // strip trailing \r\n before endstream
    let dataEnd = endStream;
    if (pdfStr[dataEnd - 1] === "\n") dataEnd--;
    if (pdfStr[dataEnd - 1] === "\r") dataEnd--;

    segments.push({
      dictStart: m.index,
      dictEnd: m.index + m[0].length,
      dataStart,
      dataEnd,
      dict,
    });
  }

  if (segments.length === 0) return buffer;

  // Process each stream.  Collect patches as { offset, oldBytes, newBytes }.
  interface Patch {
    start: number; // byte offset in original pdfStr
    end: number;
    replacement: Uint8Array;
  }
  const patches: Patch[] = [];

  for (const seg of segments) {
    const compressedBytes = raw.slice(seg.dataStart, seg.dataEnd);
    let decompressed: Uint8Array;
    try {
      decompressed = await zlibDecompress(compressedBytes);
    } catch {
      continue; // skip streams we can't decompress
    }

    const content = bytesToStr(decompressed);

    // Only process ToUnicode CMaps
    if (!content.includes("beginbfchar") && !content.includes("beginbfrange")) continue;

    const { patched, changed } = patchCmapContent(content);
    if (!changed) continue;

    const patchedBytes = strToBytes(patched);
    let recompressed: Uint8Array;
    try {
      recompressed = await zlibCompress(patchedBytes);
    } catch {
      continue;
    }

    // Update the /Length entry in the stream dictionary.
    // Dictionary is in pdfStr[seg.dictStart .. seg.dictEnd].
    const oldDict = pdfStr.slice(seg.dictStart, seg.dictEnd);
    const newLen = recompressed.length;
    const updatedDict = oldDict.replace(
      /\/Length\s+\d+/,
      `/Length ${newLen}`
    );

    // Build replacement bytes: updated dict header + new compressed data
    const headerBytes = ENC.encode(updatedDict);
    const combined = new Uint8Array(headerBytes.length + recompressed.length);
    combined.set(headerBytes, 0);
    combined.set(recompressed, headerBytes.length);

    patches.push({
      start: seg.dictStart,
      end: seg.dataEnd,
      replacement: combined,
    });
  }

  if (patches.length === 0) return buffer;

  // Apply patches from back to front (so earlier offsets stay valid).
  patches.sort((a, b) => b.start - a.start);

  let result = raw;
  for (const patch of patches) {
    const before = result.slice(0, patch.start);
    const after = result.slice(patch.end);
    const merged = new Uint8Array(before.length + patch.replacement.length + after.length);
    merged.set(before, 0);
    merged.set(patch.replacement, before.length);
    merged.set(after, before.length + patch.replacement.length);
    result = merged;
  }

  return result.buffer;
}
