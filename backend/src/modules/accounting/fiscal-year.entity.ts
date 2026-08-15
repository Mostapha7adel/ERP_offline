export type FiscalYearStatus = "open" | "closed";

export interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: FiscalYearStatus;
  closingJournalId?: string;
  closedAt?: string;
  closedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
