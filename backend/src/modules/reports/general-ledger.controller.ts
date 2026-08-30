import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import { AppError } from "../../core/errors/app-error.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function registerGeneralLedgerController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const read = requirePermission(PERMISSIONS["reports:read"]);

  typed.get("/reports/general-ledger", {
    preHandler: read,
    schema: {
      description: "General ledger report: account transactions with running balance",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        accountId: z.string(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as { accountId: string; dateFrom?: string; dateTo?: string };
    const companyId = await getDefaultCompanyId();
    const db = getDb();

    const account = await db.account.findFirst({
      where: { id: q.accountId, companyId, deletedAt: null },
    });
    if (!account) {
      throw AppError.notFound("Account not found");
    }

    const dateFrom = q.dateFrom ?? new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString();
    const dateTo = q.dateTo ?? new Date().toISOString();

    const details = await db.journalDetail.findMany({
      where: {
        accountId: q.accountId,
        deletedAt: null,
        journal: {
          companyId,
          status: "posted",
          date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        },
      },
      include: {
        journal: {
          select: { id: true, number: true, date: true, memo: true },
        },
      },
      orderBy: { journal: { date: "asc" } },
    });

    // Calculate opening balance: sum of all posted debits/credits before dateFrom
    const priorDetails = await db.journalDetail.findMany({
      where: {
        accountId: q.accountId,
        deletedAt: null,
        journal: {
          companyId,
          status: "posted",
          date: { lt: new Date(dateFrom) },
        },
      },
      select: { debit: true, credit: true },
    });

    let runningBalance = account.openingBalance +
      priorDetails.reduce((sum, d) => sum + d.debit - d.credit, 0);

    const transactions = details.map((d) => {
      const debit = round2(d.debit);
      const credit = round2(d.credit);
      runningBalance += debit - credit;
      return {
        date: d.journal.date.toISOString(),
        journalNumber: d.journal.number,
        description: d.description ?? d.journal.memo ?? "",
        debit,
        credit,
        balance: round2(runningBalance),
      };
    });

    return ok({
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
      },
      period: { from: dateFrom, to: dateTo },
      openingBalance: round2(account.openingBalance + priorDetails.reduce((s, d) => s + d.debit - d.credit, 0)),
      transactions,
      closingBalance: transactions.length > 0 ? transactions[transactions.length - 1].balance : round2(account.openingBalance + priorDetails.reduce((s, d) => s + d.debit - d.credit, 0)),
    });
  });
}
