"use client";

import { useState, useCallback } from "react";
import FileUpload from "@/components/FileUpload";
import ProgressBar from "@/components/ProgressBar";
import MetadataCard from "@/components/MetadataCard";
import SearchBar from "@/components/SearchBar";
import VoterTable from "@/components/VoterTable";
import ExportButtons from "@/components/ExportButtons";
import { parsePdfFile } from "@/lib/parser/pdfLoader";
import { filterVoters, createEmptyFilters } from "@/lib/searchUtils";
import type { ParseResult, FilterState } from "@/lib/types";

interface Progress {
  current: number;
  total: number;
  stage: string;
}

export default function Home() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 1, stage: "" });
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(createEmptyFilters());
  const [currentFile, setCurrentFile] = useState<string>("");

  const handleFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setFilters(createEmptyFilters());
    setCurrentFile(file.name);

    try {
      const parseResult = await parsePdfFile(file, (current, total, stage) => {
        setProgress({ current, total, stage });
      });

      if (parseResult.errors.length > 0 && parseResult.voters.length === 0) {
        setError(parseResult.errors[0]);
      } else {
        setResult(parseResult);
      }
    } catch (err) {
      setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filteredVoters = result ? filterVoters(result.voters, filters) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗳️</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Voter Data Extractor</h1>
              <p className="text-xs text-gray-500">বাংলাদেশ নির্বাচন কমিশন · PDF Parser</p>
            </div>
          </div>
          {result && (
            <button
              onClick={() => {
                setResult(null);
                setFilters(createEmptyFilters());
                setCurrentFile("");
                setError(null);
              }}
              className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
            >
              Upload New PDF
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Upload section */}
        {!result && !isLoading && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload a Voter List PDF</h2>
              <p className="text-gray-500 text-sm">
                Supports Bangladesh Election Commission voter list PDFs in Bangla.
                All processing happens in your browser — no data is uploaded to any server.
              </p>
            </div>
            <FileUpload onFile={handleFile} isLoading={isLoading} />

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">How to Use</h3>
              <ol className="space-y-2 text-sm text-gray-600">
                {[
                  "Upload a voter list PDF from Bangladesh Election Commission",
                  "Wait for the parser to extract voter records",
                  "Search and filter records using the search bar",
                  "Export the data as CSV or JSON",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="max-w-xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="font-medium text-gray-700">Parsing {currentFile}…</p>
              <p className="text-sm text-gray-400 mt-1">Extracting Bangla voter records</p>
            </div>
            <ProgressBar current={progress.current} total={progress.total} stage={progress.stage} />
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-semibold text-red-800 mb-2">Parsing Failed</p>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <div className="space-y-5">
            <MetadataCard
              metadata={result.metadata}
              totalVoters={result.voters.length}
              errors={result.errors}
            />
            <SearchBar
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(createEmptyFilters())}
              totalResults={filteredVoters.length}
              totalRecords={result.voters.length}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-700">
                Voter Records
                {currentFile && (
                  <span className="ml-2 text-sm font-normal text-gray-400">· {currentFile}</span>
                )}
              </h2>
              <ExportButtons
                voters={result.voters}
                filteredVoters={filteredVoters}
                filename={currentFile.replace(/\.pdf$/i, "")}
              />
            </div>
            <VoterTable voters={filteredVoters} />
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-gray-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          Voter Data Extractor · Client-side processing · No database required ·{" "}
          <span className="font-medium">All data stays in your browser</span>
        </div>
      </footer>
    </div>
  );
}
