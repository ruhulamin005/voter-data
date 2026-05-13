"use client";

import type { ParseResult } from "@/lib/types";

interface MetadataCardProps {
  metadata: ParseResult["metadata"];
  totalVoters: number;
  errors: string[];
}

export default function MetadataCard({
  metadata,
  totalVoters,
  errors,
}: MetadataCardProps) {
  const fields = [
    { label: "District", value: metadata.district },
    { label: "Upazila", value: metadata.upazila },
    { label: "Union", value: metadata.union },
    { label: "Voter Area", value: metadata.voterArea },
    { label: "Area Code", value: metadata.voterAreaCode },
    { label: "Published", value: metadata.publishDate },
  ].filter((f) => f.value);

  return (
    <div className="space-y-3">
      {/* Summary card */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-green-100 text-sm">Total Records Extracted</p>
            <p className="text-4xl font-bold">{totalVoters.toLocaleString()}</p>
          </div>
          <div className="text-5xl opacity-80">🗳️</div>
        </div>

        {fields.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
            {fields.map(({ label, value }) => (
              <div key={label}>
                <span className="text-green-200 text-xs">{label}: </span>
                <span className="text-white text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parse errors (non-critical) */}
      {errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-800 font-medium text-sm mb-2">
            ⚠ {errors.length} parsing note{errors.length > 1 ? "s" : ""}
          </p>
          <ul className="text-amber-700 text-xs space-y-1 max-h-32 overflow-y-auto">
            {errors.slice(0, 10).map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
            {errors.length > 10 && (
              <li className="text-amber-500">…and {errors.length - 10} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
