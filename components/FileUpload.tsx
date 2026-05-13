"use client";

import { useCallback, useState } from "react";

interface FileUploadProps {
  onFile: (file: File) => void;
  isLoading: boolean;
}

export default function FileUpload({ onFile, isLoading }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        alert("Please upload a PDF file.");
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${
        isDragging
          ? "border-green-500 bg-green-50"
          : "border-gray-300 hover:border-green-400 hover:bg-gray-50"
      } ${isLoading ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() =>
        !isLoading && document.getElementById("pdf-input")?.click()
      }
    >
      <input
        id="pdf-input"
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleChange}
        disabled={isLoading}
      />

      <div className="flex flex-col items-center gap-4">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
            isDragging ? "bg-green-100" : "bg-gray-100"
          }`}
        >
          📄
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-700">
            {isLoading ? "Processing PDF…" : "Upload Voter List PDF"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Drag & drop or click to browse · Bangla PDFs supported
          </p>
        </div>
        {!isLoading && (
          <button className="mt-2 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            Choose PDF
          </button>
        )}
      </div>
    </div>
  );
}
