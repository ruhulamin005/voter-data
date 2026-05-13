import type { VoterRecord, FilterState } from "./types";

function normalize(text: string): string {
  return text.normalize("NFC").toLowerCase().trim();
}

function matches(value: string, query: string): boolean {
  if (!query) return true;
  return normalize(value).includes(normalize(query));
}

export function filterVoters(voters: VoterRecord[], filters: FilterState): VoterRecord[] {
  return voters.filter((voter) => {
    // Global search across all fields
    if (filters.globalSearch) {
      const allText = Object.values(voter).join(" ");
      if (!matches(allText, filters.globalSearch)) return false;
    }

    if (!matches(voter.serialNo, filters.serialNo)) return false;
    if (!matches(voter.voterNo, filters.voterNo)) return false;
    if (!matches(voter.name, filters.name)) return false;
    if (!matches(voter.fatherName, filters.fatherName)) return false;
    if (!matches(voter.motherName, filters.motherName)) return false;
    if (!matches(voter.occupation, filters.occupation)) return false;
    if (!matches(voter.dob, filters.dob)) return false;
    if (!matches(voter.address, filters.address)) return false;

    return true;
  });
}

export function createEmptyFilters(): FilterState {
  return {
    globalSearch: "",
    serialNo: "",
    voterNo: "",
    name: "",
    fatherName: "",
    motherName: "",
    occupation: "",
    dob: "",
    address: "",
  };
}
