export interface AlertItem {
  kind: "low-stock" | "overdue-invoice" | "expiring-batch" | "recurring-due";
  severity: "warning" | "danger" | "info";
  title: string;
  message: string;
  resource: string;
  resourceId: string;
  date?: string;
}

export interface AlertsSummary {
  lowStock: AlertItem[];
  overdueInvoices: AlertItem[];
  expiringBatches: AlertItem[];
  recurringDue: AlertItem[];
  counts: Record<string, number>;
  total: number;
}