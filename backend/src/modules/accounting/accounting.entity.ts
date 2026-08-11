export type AccountClass = "asset" | "liability" | "equity" | "revenue" | "expense";
export type JournalStatus = "draft" | "posted" | "void";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountClass;
  category: string;
  isActive: boolean;
  openingBalance: number;
  parentCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLine {
  accountCode: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  number: string;
  date: string;
  memo?: string;
  status: JournalStatus;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
