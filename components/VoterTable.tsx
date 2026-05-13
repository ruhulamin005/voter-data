"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import type { VoterRecord } from "@/lib/types";

interface VoterTableProps {
  voters: VoterRecord[];
}

const columnHelper = createColumnHelper<VoterRecord>();

const columns = [
  columnHelper.accessor("serialNo", {
    header: "Serial",
    size: 70,
    cell: (info) => (
      <span className="font-mono text-xs text-gray-500">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("voterNo", {
    header: "Voter No",
    size: 150,
    cell: (info) => (
      <span className="font-mono text-xs text-blue-700">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("name", {
    header: "Name (নাম)",
    size: 160,
    cell: (info) => (
      <span className="bn font-semibold text-gray-900">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("fatherName", {
    header: "Father (পিতা)",
    size: 140,
    cell: (info) => (
      <span className="bn">{info.getValue() || "—"}</span>
    ),
  }),
  columnHelper.accessor("motherName", {
    header: "Mother (মাতা)",
    size: 140,
    cell: (info) => (
      <span className="bn">{info.getValue() || "—"}</span>
    ),
  }),
  columnHelper.accessor("occupation", {
    header: "Occupation",
    size: 120,
    cell: (info) => (
      <span className="bn px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
        {info.getValue() || "—"}
      </span>
    ),
  }),
  columnHelper.accessor("dob", {
    header: "DOB",
    size: 100,
    cell: (info) => (
      <span className="font-mono text-xs">{info.getValue() || "—"}</span>
    ),
  }),
  columnHelper.accessor("address", {
    header: "Address (ঠিকানা)",
    size: 200,
    cell: (info) => (
      <span className="bn text-xs text-gray-600">
        {info.getValue()}
      </span>
    ),
  }),
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

export default function VoterTable({ voters }: VoterTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageSize, setPageSize] = useState(50);

  const table = useReactTable({
    data: voters,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  // Keep pageSize in sync
  useMemo(() => {
    table.setPageSize(pageSize);
  }, [pageSize, table]);

  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();

  if (voters.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">🗳️</p>
        <p className="text-lg font-medium">No voter records to display</p>
        <p className="text-sm mt-1">Try adjusting your search filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-gray-50 border-b border-gray-200">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap ${
                      header.column.getCanSort()
                        ? "cursor-pointer select-none hover:text-gray-900"
                        : ""
                    }`}
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " ↑"}
                      {header.column.getIsSorted() === "desc" && " ↓"}
                      {header.column.getCanSort() && !header.column.getIsSorted() && (
                        <span className="text-gray-300">↕</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-gray-100 hover:bg-green-50 transition-colors ${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <PaginationButton
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            «
          </PaginationButton>
          <PaginationButton
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            ‹
          </PaginationButton>

          <span className="px-3 py-1.5 text-sm text-gray-700">
            Page {pageIndex + 1} of {pageCount}
          </span>

          <PaginationButton
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            ›
          </PaginationButton>
          <PaginationButton
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
          >
            »
          </PaginationButton>
        </div>

        <p className="text-sm text-gray-500">
          {pageIndex * pageSize + 1}–
          {Math.min((pageIndex + 1) * pageSize, voters.length)} of {voters.length}
        </p>
      </div>
    </div>
  );
}

function PaginationButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
