export interface VoterRecord {
  id: string;
  serialNo: string;
  voterNo: string;
  name: string;
  fatherName: string;
  motherName: string;
  occupation: string;
  dob: string;
  address: string;
}

export interface ParseResult {
  voters: VoterRecord[];
  totalFound: number;
  errors: string[];
  metadata: {
    district?: string;
    upazila?: string;
    union?: string;
    voterArea?: string;
    voterAreaCode?: string;
    publishDate?: string;
  };
}

export type SortDirection = "asc" | "desc" | false;

export interface SortState {
  field: keyof VoterRecord | null;
  direction: SortDirection;
}

export interface FilterState {
  globalSearch: string;
  serialNo: string;
  voterNo: string;
  name: string;
  fatherName: string;
  motherName: string;
  occupation: string;
  dob: string;
  address: string;
}
