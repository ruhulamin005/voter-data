/**
 * Extracts structured voter records from raw Bangla PDF text.
 *
 * PDF layout: 3 voters per row, each voter block has:
 *   XXXX। নাম: <name>       ভোটার নং: <id>
 *   পিতা: <father>
 *   মাতা: <mother>
 *   পেশা: <occupation>, জন্ম তারিখ: <dob>
 *   ঠিকানা: <address>
 *
 * ── Key PDF encoding quirk ──────────────────────────────────────────────────
 * This PDF stores glyphs in *visual* (left-to-right rendering) order rather
 * than Unicode logical order.  Pre-base vowel signs (ি U+09BF, ে U+09C7)
 * appear visually to the LEFT of the consonant they modify, so pdfjs-dist
 * emits them BEFORE that consonant:
 *
 *   পিতা  →  িপতা   (ি displaced before প)
 *   পেশা  →  িপশা   (ে/ি displaced before প)
 *   ঠিকানা →  িঠকানা  (ি displaced before ঠ)
 *   জন্ম   →  mangled (hasanta cluster not decoded reliably)
 *
 * Every label regex below accepts BOTH the correct Unicode form AND the
 * visual-order form that pdfjs-dist actually produces for this font.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { VoterRecord, ParseResult } from "../types";
import {
  normalizeBanglaText,
  cleanFieldValue,
  normalizeDate,
  banglaToAsciiDigits,
  reshapeVisualOrder,
} from "./textNormalizer";

// ---------------------------------------------------------------------------
// Label definitions
// ---------------------------------------------------------------------------

interface LabelDef {
  key: string;
  re: RegExp;
}

const LABEL_DEFS: LabelDef[] = [
  // নাম — no pre-base vowels, stable in any encoding
  { key: "name",       re: /নাম\s*[:：]\s*/g },

  // ভোটার নং — ো is compound (ে+া); pdfjs keeps it intact for this word
  { key: "voterNo",    re: /ভ[োা]টার\s*নং\s*[:：]\s*/g },

  // পিতা  ←→  িপতা  (ি pre-base, displaced before প)
  { key: "father",     re: /[িে]?প[িে]?তা\s*[:：]\s*/g },

  // মাতা — no pre-base vowels, stable
  { key: "mother",     re: /মাতা\s*[:：]\s*/g },

  // পেশা  ←→  িপশা / েপশা  (ে pre-base, may appear as ি due to font map)
  { key: "occupation", re: /[িে]?প[িে]?শা\s*[:：]\s*/g },

  // জন্ম তারিখ — জন্ম cluster is unreliably decoded; anchor only on "তারিখ"
  // which survives intact.  Optional leading "জ<anything> " to consume the
  // garbled জন্ম prefix when it is present.
  { key: "dob",        re: /(?:জ\S*\s+)?তারিখ\s*[:：]\s*/g },

  // ঠিকানা  ←→  িঠকানা  (ি pre-base, displaced before ঠ)
  { key: "address",    re: /[িে]?ঠ[িে]?কানা\s*[:：]\s*/g },
];

// ---------------------------------------------------------------------------
// Label position finder
// ---------------------------------------------------------------------------

interface LabelPosition {
  key: string;
  start: number;
  valueStart: number; // index immediately after the label+colon
}

function findLabels(text: string): LabelPosition[] {
  const positions: LabelPosition[] = [];

  for (const { key, re } of LABEL_DEFS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      positions.push({
        key,
        start: m.index,
        valueStart: m.index + m[0].length,
      });
    }
  }

  return positions.sort((a, b) => a.start - b.start);
}

/** Return cleaned text from this label's valueStart to the next label's start. */
function sliceField(
  text: string,
  labels: LabelPosition[],
  key: string
): string {
  const idx = labels.findIndex((l) => l.key === key);
  if (idx === -1) return "";
  const { valueStart } = labels[idx];
  const nextStart =
    idx + 1 < labels.length ? labels[idx + 1].start : text.length;
  return cleanFieldValue(text.slice(valueStart, nextStart));
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

function extractMetadata(text: string): ParseResult["metadata"] {
  const metadata: ParseResult["metadata"] = {};

  const m = (re: RegExp) => {
    const match = text.match(re);
    return match ? cleanFieldValue(match[1]) : undefined;
  };

  metadata.district    = m(/জেলা\s*[:：]\s*([^\s\n,]+)/);
  metadata.upazila     = m(/উপজেলা(?:\/থানা)?\s*[:：]\s*([^\s\n,]+)/);
  metadata.union       = m(/ইউনিয়ন[^:：\n]*[:：]\s*([^\n,]+)/);
  metadata.voterArea   = m(/ভ[োা]টার\s+এলাকার\s+নাম\s*[:：]\s*([^\n]+)/);
  metadata.publishDate = m(/প্রকাশের?\s+তারিখ\s*[:：]\s*([^\n]+)/);

  const codeMatch = text.match(
    /ভ[োা]টার\s+এলাকার\s+(?:নম্বর|কোড|নং)\s*[:：]\s*([০-৯\d]+)/
  );
  if (codeMatch) metadata.voterAreaCode = banglaToAsciiDigits(codeMatch[1]);

  return metadata;
}

// ---------------------------------------------------------------------------
// Split page text into per-voter chunks
// ---------------------------------------------------------------------------

function splitIntoVoterChunks(
  text: string
): Array<{ serial: string; block: string }> {
  // Matches: "০০০১। নাম:"  or  "0001. নাম:"  (both separators, both digit scripts)
  const SPLIT_RE = /([০-৯\d]{3,4})\s*[।.]\s*নাম\s*[:：]/g;

  const positions: Array<{ serial: string; start: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = SPLIT_RE.exec(text)) !== null) {
    positions.push({
      serial: banglaToAsciiDigits(match[1]),
      start: match.index,
    });
  }

  return positions.map((pos, i) => ({
    serial: pos.serial,
    block: text.slice(
      pos.start,
      i + 1 < positions.length ? positions[i + 1].start : text.length
    ),
  }));
}

// ---------------------------------------------------------------------------
// Parse one voter block
// ---------------------------------------------------------------------------

function parseVoterBlock(
  serial: string,
  block: string,
  index: number
): VoterRecord | null {
  // Collapse all whitespace (including newlines) so label positions are stable.
  const text = normalizeBanglaText(block);

  const labels = findLabels(text);

  // ── name ──────────────────────────────────────────────────────────────────
  const name = sliceField(text, labels, "name");

  // ── voter number ──────────────────────────────────────────────────────────
  const rawVoterNo = sliceField(text, labels, "voterNo");
  // Keep only the digit run; accept Bangla or ASCII digits
  const voterDigits = banglaToAsciiDigits(rawVoterNo).replace(/\D/g, "");
  const voterNo = voterDigits.length >= 10 ? voterDigits : rawVoterNo;

  // ── father ────────────────────────────────────────────────────────────────
  const fatherName = sliceField(text, labels, "father");

  // ── mother ────────────────────────────────────────────────────────────────
  const motherName = sliceField(text, labels, "mother");

  // ── occupation ────────────────────────────────────────────────────────────
  let occupation = sliceField(text, labels, "occupation");
  // When পেশা and তারিখ are on the same line the occupation slice contains
  // a trailing ", জন্ম " (or its garbled form "জ<X> ").  Strip it.
  // Pattern: last comma followed by optional space + জ<any> to end-of-value
  occupation = occupation.replace(/[,،,]\s*জ\S*\s*$/, "").trim();
  // Also strip a plain trailing comma/space
  occupation = occupation.replace(/[,\s]+$/, "").trim();

  // ── date of birth ─────────────────────────────────────────────────────────
  let dob = sliceField(text, labels, "dob");

  // If তারিখ label was not found but occupation still contains a date string,
  // extract it from there as a fallback.
  if (!dob) {
    const embedded = /(\d{2}[\/\-]\d{2}[\/\-]\d{4}|[০-৯]{2}[\/\-][০-৯]{2}[\/\-][০-৯]{4})/.exec(
      occupation
    );
    if (embedded) {
      dob = embedded[1];
      occupation = occupation.slice(0, embedded.index).replace(/[,\s]+$/, "").trim();
    }
  }

  dob = dob ? normalizeDate(dob) : "";

  // ── address ───────────────────────────────────────────────────────────────
  const address = sliceField(text, labels, "address");

  if (!name && !voterNo) return null;

  return {
    id: `voter-${index}-${serial}`,
    serialNo: serial,
    voterNo,
    // Reshape visual-order glyphs to correct Unicode logical order for display
    name:       reshapeVisualOrder(name),
    fatherName: reshapeVisualOrder(fatherName),
    motherName: reshapeVisualOrder(motherName),
    occupation: reshapeVisualOrder(occupation),
    dob,        // digits + slashes only — no reshaping needed
    address:    reshapeVisualOrder(address),
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function extractVoters(rawPages: string[]): ParseResult {
  const voters: VoterRecord[] = [];
  const errors: string[] = [];
  let metadata: ParseResult["metadata"] = {};
  let globalIndex = 0;

  for (let pageIdx = 0; pageIdx < rawPages.length; pageIdx++) {
    const pageText = rawPages[pageIdx];
    if (!pageText || pageText.trim().length < 20) continue;

    if (pageIdx <= 3) {
      const pageMeta = extractMetadata(pageText);
      metadata = { ...pageMeta, ...metadata };
    }

    const chunks = splitIntoVoterChunks(pageText);

    for (const { serial, block } of chunks) {
      try {
        const voter = parseVoterBlock(serial, block, globalIndex++);
        if (voter) voters.push(voter);
      } catch (err) {
        errors.push(`Page ${pageIdx + 1}, serial ${serial}: ${String(err)}`);
      }
    }
  }

  return {
    voters,
    totalFound: voters.length,
    errors,
    metadata,
  };
}
