"use client";

import { VoterRecord } from "@/lib/types";
import { exportToCSV, exportToJSON } from "@/lib/exportUtils";

interface ExportButtonsProps {
  voters: VoterRecord[];
  filteredVoters: VoterRecord[];
  filename?: string;
}

export default function ExportButtons({
  voters,
  filteredVoters,
  filename = "voter-data",
}: ExportButtonsProps) {
  const isFiltered = filteredVoters.length !== voters.length;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => exportToCSV(filteredVoters, `${filename}.csv`)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <span>⬇</span>
        <span>
          Export CSV{isFiltered ? ` (${filteredVoters.length})` : ""}
        </span>
      </button>
      <button
        onClick={() => exportToJSON(filteredVoters, `${filename}.json`)}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
      >
        <span>⬇</span>
        <span>
          Export JSON{isFiltered ? ` (${filteredVoters.length})` : ""}
        </span>
      </button>
      {isFiltered && (
        <>
          <button
            onClick={() => exportToCSV(voters, `${filename}-all.csv`)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
          >
            <span>⬇</span>
            <span>All CSV ({voters.length})</span>
          </button>
          <button
            onClick={() => exportToJSON(voters, `${filename}-all.json`)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
          >
            <span>⬇</span>
            <span>All JSON ({voters.length})</span>
          </button>
        </>
      )}
    </div>
  );
}
