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
 * Parsing strategy: locate each Bangla field label in the block text,
 * sort the positions, then slice the value between consecutive labels.
 * This avoids relying on newlines (which collapse after normalisation)
 * or character-class exclusions (which silently drop partial matches).
 */

import { VoterRecord, ParseResult } from "../types";
import {
  normalizeBanglaText,
  cleanFieldValue,
  normalizeDate,
  banglaToAsciiDigits,
} from "./textNormalizer";

// ---------------------------------------------------------------------------
// Label definitions — order does not matter; we sort by match position.
// Each pattern anchors at the label keyword so it can't double-match.
// ---------------------------------------------------------------------------

interface LabelDef {
  key: string;
  re: RegExp;
}

const LABEL_DEFS: LabelDef[] = [
  // Serial+name header: "০০০১। নাম:" or "0001. নাম:"
  { key: "name",       re: /নাম\s*[:：]\s*/g },
  // Voter number: ভোটার / ভাটার (CID variant)
  { key: "voterNo",    re: /ভ[োা]টার\s*নং\s*[:：]\s*/g },
  { key: "father",     re: /পিতা\s*[:：]\s*/g },
  { key: "mother",     re: /মাতা\s*[:：]\s*/g },
  { key: "occupation", re: /পেশা\s*[:：]\s*/g },
  // DOB may appear on same line as occupation: "পেশা: ব্যবসা, জন্ম তারিখ: ০২/০৩/১৯৮৬"
  { key: "dob",        re: /জন্ম\s*তারিখ\s*[:：]\s*/g },
  { key: "address",    re: /ঠিকানা\s*[:：]\s*/g },
];

interface LabelPosition {
  key: string;
  start: number;
  valueStart: number; // index immediately after the colon+space
}

/**
 * Locate every known label in `text` and return them sorted by position.
 * We use RegExp.exec with sticky lastIndex so each label is found once.
 */
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

/**
 * Given a sorted label list, return the value text for `key`:
 * everything from valueStart up to the next label's start.
 */
function extractBetweenLabels(
  text: string,
  labels: LabelPosition[],
  key: string
): string {
  const idx = labels.findIndex((l) => l.key === key);
  if (idx === -1) return "";

  const { valueStart } = labels[idx];
  const nextStart = idx + 1 < labels.length ? labels[idx + 1].start : text.length;

  return cleanFieldValue(text.slice(valueStart, nextStart));
}

// ---------------------------------------------------------------------------
// Metadata extraction from header pages
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

  const codeMatch = text.match(/ভ[োা]টার\s+এলাকার\s+(?:নম্বর|কোড|নং)\s*[:：]\s*([০-৯\d]+)/);
  if (codeMatch) metadata.voterAreaCode = banglaToAsciiDigits(codeMatch[1]);

  return metadata;
}

// ---------------------------------------------------------------------------
// Split page text into per-voter chunks
// ---------------------------------------------------------------------------

/**
 * Each voter block starts with a 4-digit Bangla/ASCII serial followed by
 * "।" (Devanagari danda) or "." then optional space then "নাম:".
 * We find all such anchors and slice between them.
 */
function splitIntoVoterChunks(
  text: string
): Array<{ serial: string; block: string }> {
  // Accept: ০০০১। নাম:  or  0001. নাম:  or  ০০০১. নাম:
  const SPLIT_RE = /([০-৯\d]{3,4})\s*[।.]\s*নাম\s*[:：]/g;

  const positions: Array<{ serial: string; start: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = SPLIT_RE.exec(text)) !== null) {
    positions.push({
      serial: banglaToAsciiDigits(match[1]),
      start: match.index,
    });
  }

  const chunks: Array<{ serial: string; block: string }> = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start;
    const end =
      i + 1 < positions.length ? positions[i + 1].start : text.length;
    chunks.push({
      serial: positions[i].serial,
      block: text.slice(start, end),
    });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Parse a single voter block
// ---------------------------------------------------------------------------

function parseVoterBlock(
  serial: string,
  block: string,
  index: number
): VoterRecord | null {
  // Collapse whitespace (including newlines) to single spaces so that
  // label positions are stable regardless of line-break placement.
  const text = normalizeBanglaText(block);

  const labels = findLabels(text);

  // ---- name ---------------------------------------------------------------
  const name = extractBetweenLabels(text, labels, "name");

  // ---- voter number -------------------------------------------------------
  const rawVoterNo = extractBetweenLabels(text, labels, "voterNo");
  // Keep only the digit run (drop any stray prefix characters)
  const voterNoDigits = banglaToAsciiDigits(rawVoterNo).replace(/\D/g, "");
  const voterNo = voterNoDigits.length >= 10 ? voterNoDigits : rawVoterNo;

  // ---- father / mother ----------------------------------------------------
  const fatherName = extractBetweenLabels(text, labels, "father");
  const motherName = extractBetweenLabels(text, labels, "mother");

  // ---- occupation + DOB (may share one line) ------------------------------
  let occupation = extractBetweenLabels(text, labels, "occupation");
  let dob = extractBetweenLabels(text, labels, "dob");

  // If DOB was not found as a standalone label, it might be embedded in the
  // occupation value: "ব্যবসা, জন্ম তারিখ: ০২/০৩/১৯৮৬"
  if (!dob) {
    const embedded = /জন্ম\s*তারিখ\s*[:：]\s*([^\s,]+)/.exec(occupation);
    if (embedded) {
      dob = cleanFieldValue(embedded[1]);
      // Trim occupation at the জন্ম তারিখ label
      occupation = cleanFieldValue(
        occupation.slice(0, occupation.indexOf("জন্ম"))
      );
    }
  }

  // Strip trailing comma/space from occupation (e.g. "ব্যবসা,")
  occupation = occupation.replace(/[,،,\s]+$/, "").trim();
  dob = dob ? normalizeDate(dob) : "";

  // ---- address ------------------------------------------------------------
  const address = extractBetweenLabels(text, labels, "address");

  if (!name && !voterNo) return null;

  return {
    id: `voter-${index}-${serial}`,
    serialNo: serial,
    voterNo,
    name,
    fatherName,
    motherName,
    occupation,
    dob,
    address,
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
        errors.push(
          `Page ${pageIdx + 1}, serial ${serial}: ${String(err)}`
        );
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
