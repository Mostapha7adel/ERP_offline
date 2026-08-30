export type PeriodCloseStatus = "open" | "closed";

export interface PeriodClose {
  id: string;
  period: string;
  status: PeriodCloseStatus;
  closedAt?: string;
  closedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
