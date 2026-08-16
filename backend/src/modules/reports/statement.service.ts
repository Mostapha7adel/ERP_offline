import { invoiceRepository } from "../trade/invoice.repository.js";
import { partyRepository } from "../parties/party.repository.js";
import { noteRepository } from "../notes/note.repository.js";
import { treasuryTransactionRepository } from "../treasury/treasury.repository.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface StatementRow {
  date: string;
  kind: string;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export class StatementService {
  /** Full period (defaults to all history) statement for a party with running balance. */
  async forParty(partyId: string, from?: string, to?: string) {
    const party = await partyRepository.findById(partyId);
    if (!party) throw new Error("Party not found");
    const kind = party.type === "customer" ? "sales" : "purchase";

    const entries: Array<{ date: string; kind: string; ref: string; description: string; debit: number; credit: number }> = [];

    const allInvoices = await invoiceRepository.findAll();
    for (const inv of allInvoices) {
      const linked = party.type === "customer" ? inv.customerId === party.id : inv.supplierId === party.id;
      if (inv.type === kind && inv.status !== "void" && linked) {
        entries.push({
          date: inv.invoiceDate,
          kind: "invoice",
          ref: inv.number,
          description: inv.type === "sales" ? "Sales invoice" : "Purchase invoice",
          debit: round2(inv.total),
          credit: 0,
        });
      }
    }

    for (const t of await treasuryTransactionRepository.findAll()) {
      const isPayment =
        (party.type === "customer" && t.type === "income") ||
        (party.type === "supplier" && t.type === "expense");
      if (isPayment && t.partyId === party.id) {
        entries.push({
          date: t.date,
          kind: "payment",
          ref: t.reference ?? "",
          description: t.description ?? "",
          debit: 0,
          credit: round2(t.amount),
        });
      }
    }

    for (const n of await noteRepository.byParty(party.id, kind)) {
      entries.push({
        date: n.noteDate,
        kind: n.noteType === "credit" ? "credit-note" : "debit-note",
        ref: n.number,
        description: n.noteType === "credit" ? "Credit note" : "Debit note",
        debit: n.noteType === "debit" ? round2(n.total) : 0,
        credit: n.noteType === "credit" ? round2(n.total) : 0,
      });
    }

    const order: Record<string, number> = { invoice: 0, "debit-note": 1, "credit-note": 2, payment: 3 };
    const sortEntries = (a: { date: string; kind: string }, b: { date: string; kind: string }) =>
      a.date.localeCompare(b.date) || (order[a.kind] ?? 9) - (order[b.kind] ?? 9);

    const start = from ?? "0000-01-01";
    const end = to ?? "9999-12-31";
    const opening = round2(entries.filter((e) => e.date < start).reduce((s, e) => s + e.debit - e.credit, 0));
    let running = opening;
    const rows: StatementRow[] = entries
      .filter((e) => e.date >= start && e.date <= end)
      .sort(sortEntries)
      .map((e) => {
        running = round2(running + e.debit - e.credit);
        return { ...e, runningBalance: running };
      });

    return {
      party: { id: party.id, name: party.name, type: party.type, currency: party.currency },
      period: { from: start, to: end },
      opening,
      closing: running,
      rows,
    };
  }
}

export const statementService = new StatementService();