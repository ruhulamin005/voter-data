/**
 * Normalizes Bangla Unicode text extracted from PDFs.
 * Handles common encoding artifacts, broken glyphs, and spacing issues.
 */

// Map common CID artifacts that appear in pdfjs text extraction
const CID_MAP: Record<string, string> = {
  "(cid:207)": "ে",
  "(cid:206)": "ি",
  "(cid:208)": "ৈ",
  "(cid:203)": "া",
  "(cid:204)": "ু",
  "(cid:205)": "ূ",
  "(cid:209)": "ো",
  "(cid:210)": "ৌ",
  "(cid:253)": "ঞ",
  "(cid:295)": "দ্র",
  "(cid:296)": "স্ন",
  "(cid:279)": "দ্দ",
  "(cid:290)": "ষ্ট",
  "(cid:303)": "ন্য",
  "(cid:308)": "প্র",
  "(cid:309)": "ব্র",
  "(cid:314)": "ব্দ",
  "(cid:324)": "ম্ব",
  "(cid:327)": "ন্ন",
  "(cid:332)": "দ্ধ",
  "(cid:340)": "শ্চ",
  "(cid:344)": "শ্র",
  "(cid:349)": "ষ্ণ",
  "(cid:350)": "স্ট",
  "(cid:353)": "ষ্প",
  "(cid:361)": "জ্ঞ",
  "(cid:383)": "ন্দ্র",
  "(cid:384)": "ক্র",
  "(cid:385)": "র",
  "(cid:390)": "হ্ন",
  "(cid:419)": "ক",
};

// Bangla numeral to ASCII
const BANGLA_DIGITS: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

export function replaceCidArtifacts(text: string): string {
  let result = text;
  for (const [cid, replacement] of Object.entries(CID_MAP)) {
    result = result.split(cid).join(replacement);
  }
  // Remove any remaining (cid:XXX) patterns
  result = result.replace(/\(cid:\d+\)/g, "");
  return result;
}

export function normalizeBanglaText(text: string): string {
  if (!text) return "";

  let result = replaceCidArtifacts(text);

  // Normalize Unicode: NFC composition
  result = result.normalize("NFC");

  // Remove zero-width joiners and non-joiners used inconsistently
  result = result.replace(/[‌‍]/g, "");

  // Collapse multiple spaces/newlines to single space
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

export function banglaToAsciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] ?? d);
}

export function normalizeDate(text: string): string {
  // Normalize dates like ২০/০৫/১৯৭৬ or 20/05/1976
  const withAscii = banglaToAsciiDigits(text);
  const match = withAscii.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (match) {
    return `${match[1]}/${match[2]}/${match[3]}`;
  }
  return withAscii.trim();
}

export function cleanFieldValue(value: string): string {
  return normalizeBanglaText(value)
    .replace(/^[:\s।,]+/, "")
    .replace(/[:\s।,]+$/, "")
    .trim();
}
