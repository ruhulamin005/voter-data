import type { VoterRecord } from "./types";

const HEADERS: Array<{ key: keyof VoterRecord; label: string }> = [
  { key: "serialNo", label: "Serial No" },
  { key: "voterNo", label: "Voter No" },
  { key: "name", label: "Name (নাম)" },
  { key: "fatherName", label: "Father Name (পিতা)" },
  { key: "motherName", label: "Mother Name (মাতা)" },
  { key: "occupation", label: "Occupation (পেশা)" },
  { key: "dob", label: "Date of Birth" },
  { key: "address", label: "Address (ঠিকানা)" },
];

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCSV(voters: VoterRecord[], filename = "voter-data.csv") {
  const headerRow = HEADERS.map((h) => h.label).join(",");
  const rows = voters.map((v) =>
    HEADERS.map((h) => escapeCSV(String(v[h.key] ?? ""))).join(",")
  );

  const csvContent = "﻿" + [headerRow, ...rows].join("\n"); // BOM for Excel UTF-8
  downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
}

export function exportToJSON(voters: VoterRecord[], filename = "voter-data.json") {
  const data = voters.map(({ id: _id, ...rest }) => rest); // strip internal id
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, "application/json");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
