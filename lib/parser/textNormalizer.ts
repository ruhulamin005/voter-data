/**
 * Normalizes Bangla Unicode text extracted from PDFs.
 * Handles common encoding artifacts, broken glyphs, and spacing issues.
 */

// Map common CID artifacts that appear in pdfminer/server-side text extraction.
// Font: OZHNWW+Bangla (CIDFontType2, Identity-H, Bijoy-style Bengali).
// CIDs marked [CORRECTED] differ from the incomplete ToUnicode table in the PDF.
const CID_MAP: Record<string, string> = {
  // Vowel signs (matras) — confirmed from ToUnicode table
  "(cid:203)": "া", // আ-কার
  "(cid:204)": "ু", // উ-কার
  "(cid:205)": "ূ", // ঊ-কার
  "(cid:206)": "ি", // ই-কার (real ি; reph র্ shares this slot in pdfjs path)
  "(cid:207)": "ে", // এ-কার pre-base glyph [CORRECTED: ToUnicode had ো]
  "(cid:208)": "ৈ", // ঐ-কার
  "(cid:209)": "ো", // ও-কার (composite)
  "(cid:210)": "ৌ", // ঔ-কার

  // Conjuncts — confirmed / corrected via context analysis
  "(cid:251)": "ঞ্চ", // ঞ্চ conjunct (অঞ্চল) [NEW]
  "(cid:253)": "ঞ্জ", // ঞ্জ conjunct (কেরানীগঞ্জ) [CORRECTED: was ঞ]
  "(cid:276)": "ত্র", // ত্র conjunct (ছাত্র/ছাত্রী) [NEW]
  "(cid:279)": "দ্দ", // দ্দ conjunct
  "(cid:290)": "ন্ত", // ন্ত conjunct (চূড়ান্ত) [CORRECTED: was ষ্ট]
  "(cid:293)": "ন্ম", // ন্ম conjunct (জন্ম) [NEW]
  "(cid:295)": "ন্দ্র", // ন্দ্র conjunct (চন্দ্র) [CORRECTED: was দ্র]
  "(cid:296)": "স্ন", // স্ন conjunct
  "(cid:303)": "ন্য", // ন্য conjunct
  "(cid:308)": "প্র", // প্র conjunct
  "(cid:309)": "ব্র", // ব্র conjunct
  "(cid:314)": "ব্দ", // ব্দ conjunct
  "(cid:324)": "ম্ব", // ম্ব conjunct
  "(cid:327)": "ন্ন", // ন্ন conjunct
  "(cid:332)": "দ্ধ", // দ্ধ conjunct
  "(cid:340)": "শ্চ", // শ্চ conjunct
  "(cid:344)": "শ্র", // শ্র conjunct
  "(cid:349)": "ষ্ণ", // ষ্ণ conjunct
  "(cid:350)": "স্ট", // স্ট conjunct
  "(cid:353)": "ষ্প", // ষ্প conjunct
  "(cid:361)": "ড়", // ড় (RRA) [CORRECTED: was জ্ঞ]
  "(cid:383)": "ন্দ্র", // ন্দ্র conjunct (longer form)
  "(cid:384)": "ক্র", // ক্র conjunct
  "(cid:385)": "র", // র

  // Single consonants / finals
  "(cid:390)": "হ", // হ consonant [CORRECTED: was হ্ন]
  "(cid:419)": "ক", // ক consonant
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
