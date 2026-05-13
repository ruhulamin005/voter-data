# 🗳️ Voter Data Extractor

A production-quality, **local-first web application** for extracting and searching Bangla voter records from Bangladesh Election Commission PDF files. All processing happens in the browser — no backend, no database.

---

## ✨ Features

- **PDF Upload** — Drag-and-drop or click to upload voter list PDFs
- **Bangla PDF Parsing** — Handles Bangladesh NID/voter list format with Bangla Unicode text
- **Structured Extraction** — Extracts Serial No, Voter No, Name, Father, Mother, Occupation, DOB, and Address
- **Instant Search** — Global search + per-field filters, all client-side
- **Sortable Table** — Click any column header to sort ascending/descending
- **Pagination** — Configurable page size (25/50/100/250 rows)
- **CSV Export** — UTF-8 BOM encoded for Excel compatibility with Bangla text
- **JSON Export** — Structured JSON for programmatic use
- **Export filtered results** — Export only what you see, or the full dataset
- **Progress indicator** — Page-by-page parsing progress
- **No database** — Zero setup, works offline after first load

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | TailwindCSS |
| Table | TanStack Table v8 |
| PDF Parsing | pdfjs-dist (client-side, WebAssembly) |
| Text Normalization | Custom Bangla Unicode parser |

---

## 📁 Folder Structure

```
voter-data/
├── app/
│   ├── layout.tsx          # Root layout + metadata
│   └── page.tsx            # Main application page
├── components/
│   ├── FileUpload.tsx       # Drag-and-drop file uploader
│   ├── ProgressBar.tsx      # Parsing progress indicator
│   ├── MetadataCard.tsx     # District/area info + stats
│   ├── SearchBar.tsx        # Global + per-field search
│   ├── VoterTable.tsx       # Sortable/paginated data table
│   └── ExportButtons.tsx    # CSV/JSON export controls
├── lib/
│   ├── types.ts             # TypeScript interfaces
│   ├── exportUtils.ts       # CSV/JSON export logic
│   ├── searchUtils.ts       # Client-side filtering
│   └── parser/
│       ├── pdfLoader.ts     # PDF.js extraction driver
│       ├── voterExtractor.ts # Voter record parser
│       └── textNormalizer.ts # Bangla Unicode normalizer
├── public/
└── sample.pdf.pdf           # Sample voter list PDF
```

---

## 🚀 Installation & Local Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd voter-data

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

---

## ☁️ Vercel Deployment

1. Push the repository to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy** — no environment variables required

The app is entirely static/client-side and deploys with zero configuration.

---

## 📊 How PDF Parsing Works

### PDF Structure

Bangladesh Election Commission voter lists follow this layout:
- **3-column grid** per page
- Each voter block starts with a 4-digit Bangla serial number (e.g., `০০০১.`)
- Fields: নাম (Name), ভোটার নং (Voter No), পিতা (Father), মাতা (Mother), পেশা (Occupation), জন্ম তারিখ (DOB), ঠিকানা (Address)

### Parsing Pipeline

```
PDF File
  → pdfjs-dist (WebAssembly PDF renderer)
  → Raw text per page (with Y-position line grouping)
  → CID artifact removal (handles font encoding issues)
  → Bangla Unicode normalization (NFC)
  → Serial number detection (splits text into voter chunks)
  → Regex-based field extraction per chunk
  → Bangla numeral → ASCII conversion for IDs/dates
  → Structured VoterRecord objects
```

### Handled Edge Cases

- `(cid:XXX)` font encoding artifacts from non-standard Bangla fonts
- Bangla digits (০১২৩...) in voter IDs and dates
- Multi-line addresses
- 3-column layout text flowing across columns
- Inconsistent spacing and Unicode composition variants

---

## 🔍 How To Use

### 1. Upload PDF
Drag and drop a voter list PDF onto the upload area, or click "Choose PDF" to browse. The file never leaves your browser.

### 2. Wait for Parsing
A progress bar shows page-by-page extraction progress. A typical 80-page PDF parses in under 10 seconds.

### 3. Search / Filter Records
- Use the **global search** box to search across all fields simultaneously (Bangla text supported)
- Use **per-field filters** below to narrow by Serial No, Voter No, Name, Father, Mother, Occupation, DOB, or Address
- Click any **column header** to sort

### 4. Export CSV / JSON
- **Export CSV** — downloads the currently filtered results as a UTF-8 CSV (Excel-compatible)
- **Export JSON** — downloads structured JSON
- When filters are active, extra buttons appear to export the **full unfiltered dataset**

---

## 📋 Exported Data Format

### CSV Columns
`Serial No, Voter No, Name (নাম), Father Name (পিতা), Mother Name (মাতা), Occupation (পেশা), Date of Birth, Address (ঠিকানা)`

### JSON Structure
```json
[
  {
    "serialNo": "0001",
    "voterNo": "2606180676785",
    "name": "মোঃ আজিজুল হক",
    "fatherName": "নবাব মিয়া",
    "motherName": "চন্দ্র বান বেগম",
    "occupation": "বেসরকারী চাকরী",
    "dob": "20/05/1976",
    "address": "ভাওয়ার ভিটি, করানীগঞ্জ, ঢাকা"
  }
]
```

---

## 🔒 Privacy

All PDF processing runs entirely in your browser using WebAssembly. No voter data is transmitted to any server. The application can work offline after the initial page load.

---

## 📄 License

MIT
