"use client";

import { FilterState } from "@/lib/types";

interface SearchBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  totalResults: number;
  totalRecords: number;
}

const FIELD_LABELS: Array<{ key: keyof Omit<FilterState, "globalSearch">; label: string; placeholder: string }> = [
  { key: "serialNo", label: "Serial No", placeholder: "e.g. 0001" },
  { key: "voterNo", label: "Voter No", placeholder: "Voter ID number" },
  { key: "name", label: "Name", placeholder: "নাম" },
  { key: "fatherName", label: "Father Name", placeholder: "পিতার নাম" },
  { key: "motherName", label: "Mother Name", placeholder: "মাতার নাম" },
  { key: "occupation", label: "Occupation", placeholder: "পেশা" },
  { key: "dob", label: "Date of Birth", placeholder: "DD/MM/YYYY" },
  { key: "address", label: "Address", placeholder: "ঠিকানা" },
];

export default function SearchBar({
  filters,
  onChange,
  onReset,
  totalResults,
  totalRecords,
}: SearchBarProps) {
  const update = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      {/* Global Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
          🔍
        </span>
        <input
          type="text"
          value={filters.globalSearch}
          onChange={(e) => update("globalSearch", e.target.value)}
          placeholder="Search across all fields… (supports Bangla)"
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition"
        />
        {filters.globalSearch && (
          <button
            onClick={() => update("globalSearch", "")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Field-specific filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {FIELD_LABELS.map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {label}
            </label>
            <input
              type="text"
              value={filters[key]}
              onChange={(e) => update(key, e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition"
            />
          </div>
        ))}
      </div>

      {/* Results summary and reset */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-sm text-gray-500">
          Showing{" "}
          <span className="font-semibold text-gray-800">{totalResults}</span> of{" "}
          <span className="font-semibold text-gray-800">{totalRecords}</span>{" "}
          records
        </p>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-sm text-green-600 hover:text-green-800 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
