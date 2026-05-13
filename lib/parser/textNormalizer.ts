/**
 * Normalizes Bangla Unicode text extracted from PDFs.
 * Handles common encoding artifacts, broken glyphs, and spacing issues.
 */

// Map common CID artifacts that appear in pdfjs text extraction
const CID_MAP: Record<string, string> = {
  "(cid:207)": "ো", // ো
  "(cid:206)": "ি", // ি
  "(cid:208)": "ৈ", // ৈ
  "(cid:203)": "া", // া
  "(cid:204)": "ু", // ু
  "(cid:205)": "ূ", // ূ
  "(cid:209)": "ো", // ো
  "(cid:210)": "ৌ", // ৌ
  "(cid:253)": "ঞ", // ঞ
  "(cid:295)": "দ্র", // দ্র
  "(cid:296)": "স্ন", // স্ন
  "(cid:279)": "দ্দ", // দ্দ
  "(cid:290)": "ষ্ট", // ষ্ট
  "(cid:303)": "ন্য", // ন্য
  "(cid:308)": "প্র", // প্র
  "(cid:309)": "ব্র", // ব্র
  "(cid:314)": "ব্দ", // ব্দ
  "(cid:324)": "ম্ব", // ম্ব
  "(cid:327)": "ন্ন", // ন্ন
  "(cid:332)": "দ্ধ", // দ্ধ
  "(cid:340)": "শ্চ", // শ্চ
  "(cid:344)": "শ্র", // শ্র
  "(cid:349)": "ষ্ণ", // ষ্ণ
  "(cid:350)": "স্ট", // স্ট
  "(cid:353)": "ষ্প", // ষ্প
  "(cid:361)": "জ্ঞ", // জ্ঞ
  "(cid:383)": "ন্দ্র", // ন্দ্র
  "(cid:384)": "ক্র", // ক্র
  "(cid:385)": "র", // র
  "(cid:390)": "হ্ন", // হ্ন
  "(cid:419)": "ক", // ক
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

// ---------------------------------------------------------------------------
// Visual-order reshaping
// ---------------------------------------------------------------------------
// This PDF stores glyphs in visual (left-to-right render) order.
// Pre-base Bengali vowel signs appear BEFORE the consonant in the byte
// stream even though Unicode logical order requires them AFTER it.
//
//   Extracted:  িপতা  (িপতা)
//   Correct:    পিতা  (পিতা)
//
// Additionally this font maps ে (U+09C7) to ি (U+09BF), so the compound
// vowel ো (U+09CB = ে+া) is extracted as ি before consonant then া after.
// We reconstruct it with a second pass.
//
// IMPORTANT: the character class for Bengali consonants is built from hex
// escapes only.  Writing ড়, য় etc. as literal source characters causes
// "Range out of order" errors because those glyphs are stored as two
// codepoints (base + nukta U+09BC) by most text editors, so the RegExp
// engine cannot treat them as a single range boundary.
//
// Apply reshaping to DISPLAY VALUES only — the parser uses visual-order
// label patterns to locate fields and must not be reshaped first.

// Bengali consonant codepoints (hex escapes = guaranteed single codepoints)
//   ক-হ  main consonants (ক–হ)
//   ৎ         ৎ  (khanda ta)
//   ড়         ড়  (precomposed RRA)
//   ঢ়         ঢ়  (precomposed RHA)
//   য়         য়  (precomposed YYA)
//   ৰৱ   ৰ ৱ  (Assamese forms)
const BENG_CONSONANTS =
  "ক-হৎড়ঢ়য়ৰৱ";

// Compile once; reusing compiled regexes avoids per-call overhead
const RE_PREBASE = new RegExp(
  "([\\u09BF\\u09C7])([" + BENG_CONSONANTS + "])",
  "g"
);
const RE_I_AA = new RegExp(
  "([" + BENG_CONSONANTS + "])\\u09BF\\u09BE",
  "g"
);

export function reshapeVisualOrder(text: string): string {
  if (!text) return text;

  // Step 1 — reorder: pre-base vowel before consonant → after consonant
  //   িপতা → পিতা,  িঠকানা → ঠিকানা,  িভিট → ভিটি
  let result = text.replace(RE_PREBASE, "$2$1");

  // Step 2 — reconstruct ো: consonant + ি + া → consonant + ো
  //   মোঃ was extracted as িমাঃ; step 1 gives মিাঃ; here মিা → মো
  result = result.replace(RE_I_AA, "$1ো"); // ো = ো

  // NFC collapses any ে+া two-char sequences into the ো precomposed form
  return result.normalize("NFC");
}
