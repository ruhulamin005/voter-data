/**
 * Extracts structured voter records from raw Bangla PDF text.
 *
 * PDF layout: 3 voters per row, each voter block has:
 *   XXXX. নাম: <name>       ভোটার নং: <id>
 *   পিতা: <father>
 *   মাতা: <mother>
 *   পেশা: <occupation>,জন্ম তারিখ:<dob>
 *   ঠিকানা: <address>
 */

import { VoterRecord, ParseResult } from "../types";
import {
  normalizeBanglaText,
  cleanFieldValue,
  normalizeDate,
  banglaToAsciiDigits,
} from "./textNormalizer";

// Match serial numbers like ০০০১. or 0001.
const SERIAL_PATTERN =
  /([০-৯\d]{4})\.\s*(?:নাম|িনাম|িনা|না)\s*[:：]\s*/;

// Voter number is a long digit string (Bengali or ASCII)
const VOTER_NO_PATTERN = /(?:ভোটার|ভাটার|ভ[আ]টার)\s*নং\s*[:：]\s*([০-৯\d]{13,17})/;

const FATHER_PATTERN = /পিতা\s*[:：]\s*([^মাতাপেশাঠিকানাভোটার\n]+)/;
const MOTHER_PATTERN = /মাতা\s*[:：]\s*([^পিতাপেশাঠিকানাভোটার\n]+)/;
const OCCUPATION_PATTERN = /পেশা\s*[:：]\s*([^,,জন্মজ\n]+)/;
const DOB_PATTERN = /জন্ম\s*তারিখ\s*[:：]\s*([০-৯\d\/\-]+)/;
const ADDRESS_PATTERN = /ঠিকানা\s*[:：]\s*([^\n০-৯\d]+(?:\n[^\n০-৯\d]+)*)/;

// Bangla serial pattern for text like "০০০১."
const BANGLA_SERIAL_RE = /([০-৯]{4}|[0-9]{4})\./;

function extractMetadata(text: string) {
  const metadata: ParseResult["metadata"] = {};

  const districtMatch = text.match(/জেলা\s*[:：]\s*([^\s\n]+)/);
  if (districtMatch) metadata.district = cleanFieldValue(districtMatch[1]);

  const upazilaMatch = text.match(/উপজেলা\/থানা\s*[:：]\s*([^\s\n]+)/);
  if (upazilaMatch) metadata.upazila = cleanFieldValue(upazilaMatch[1]);

  const unionMatch = text.match(/ইউনিয়ন\/ওয়ার্ড[^:：\n]*[:：]\s*([^\n]+)/);
  if (unionMatch) metadata.union = cleanFieldValue(unionMatch[1]);

  const areaMatch = text.match(
    /ভোটার\s+এলাকার\s+নাম\s*[:：]\s*([^\n]+)/
  );
  if (areaMatch) metadata.voterArea = cleanFieldValue(areaMatch[1]);

  const areaCodeMatch = text.match(
    /ভোটার\s+এলাকার\s+নম্বর\s*[:：]\s*([০-৯\d]+)/
  );
  if (areaCodeMatch) metadata.voterAreaCode = banglaToAsciiDigits(areaCodeMatch[1]);

  const dateMatch = text.match(/প্রকাশের\s+তারিখ\s*[:：]\s*([^\n]+)/);
  if (dateMatch) metadata.publishDate = cleanFieldValue(dateMatch[1]);

  return metadata;
}

/**
 * Split a page's text into individual voter chunks.
 * Each voter starts with a 4-digit serial like "০০০১."
 */
function splitIntoVoterChunks(text: string): Array<{ serial: string; block: string }> {
  const chunks: Array<{ serial: string; block: string }> = [];

  // Match positions of all serial numbers in the text
  const serialGlobalRe = /([০-৯]{4}|[0-9]{4})\.\s*(?:নাম|িনাম)/g;
  let match: RegExpExecArray | null;
  const positions: Array<{ serial: string; start: number }> = [];

  while ((match = serialGlobalRe.exec(text)) !== null) {
    positions.push({ serial: banglaToAsciiDigits(match[1]), start: match.index });
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start;
    const end = i + 1 < positions.length ? positions[i + 1].start : text.length;
    chunks.push({
      serial: positions[i].serial,
      block: text.slice(start, end),
    });
  }

  return chunks;
}

function extractField(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match) return "";
  return cleanFieldValue(match[1]);
}

function parseVoterBlock(
  serial: string,
  block: string,
  index: number
): VoterRecord | null {
  const normalized = normalizeBanglaText(block);

  // Extract voter number
  const voterNoMatch = normalized.match(
    /(?:ভোটার|ভাটার)\s*নং\s*[:：]\s*([০-৯\d]{10,17})/
  );
  const voterNo = voterNoMatch
    ? banglaToAsciiDigits(cleanFieldValue(voterNoMatch[1]))
    : "";

  // Extract name (text between নাম: and ভোটার নং:)
  const nameMatch = normalized.match(
    /(?:[০-৯\d]{4})\.\s*নাম\s*[:：]\s*([^ভোটার]+?)(?=ভাটার|ভোটার|$)/
  );
  const name = nameMatch ? cleanFieldValue(nameMatch[1]) : "";

  // Father
  const fatherMatch = normalized.match(/পিতা\s*[:：]\s*(.+?)(?=মাতা\s*[:：]|পেশা\s*[:：]|$)/);
  const fatherName = fatherMatch ? cleanFieldValue(fatherMatch[1]) : "";

  // Mother
  const motherMatch = normalized.match(/মাতা\s*[:：]\s*(.+?)(?=পেশা\s*[:：]|ঠিকানা\s*[:：]|পিতা\s*[:：]|$)/);
  const motherName = motherMatch ? cleanFieldValue(motherMatch[1]) : "";

  // Occupation
  const occupationMatch = normalized.match(/পেশা\s*[:：]\s*(.+?)(?=[,,]জন্ম|জ[ন্ম]|$)/);
  const occupation = occupationMatch ? cleanFieldValue(occupationMatch[1]) : "";

  // DOB — look for date pattern after জন্ম তারিখ or জন্ম
  const dobMatch = normalized.match(/জন্ম\s*(?:তারিখ\s*)?[:：]?\s*([০-৯\d]{2}[\/\-][০-৯\d]{2}[\/\-][০-৯\d]{4})/);
  const dob = dobMatch ? normalizeDate(dobMatch[1]) : "";

  // Address
  const addressMatch = normalized.match(/ঠিকানা\s*[:：]\s*(.+?)(?=\s*[০-৯\d]{4}\.|$)/s);
  const address = addressMatch ? cleanFieldValue(addressMatch[1]) : "";

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

export function extractVoters(rawPages: string[]): ParseResult {
  const voters: VoterRecord[] = [];
  const errors: string[] = [];
  let metadata: ParseResult["metadata"] = {};
  let globalIndex = 0;

  for (let pageIdx = 0; pageIdx < rawPages.length; pageIdx++) {
    const pageText = rawPages[pageIdx];
    if (!pageText || pageText.trim().length < 20) continue;

    // Extract metadata from first content page
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
