import { AppError } from "../../core/errors/app-error.js";
import { periodCloseRepository } from "./period-close.repository.js";
import { closePeriodSchema, openPeriodSchema, type ClosePeriodInput, type OpenPeriodInput } from "./period-close.schema.js";
import type { PeriodClose } from "./period-close.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";

export class PeriodCloseService {
  async list(): Promise<PeriodClose[]> {
    return periodCloseRepository.findAll();
  }

  async getByPeriod(period: string): Promise<PeriodClose> {
    const record = await periodCloseRepository.findByPeriod(period);
    if (!record) {
      return periodCloseRepository.create({
        data: {
          period,
          status: "open",
        },
      });
    }
    return record;
  }

  async close(input: ClosePeriodInput, audit: AuditContext): Promise<PeriodClose> {
    const validated = closePeriodSchema.parse(input);
    const principalId = audit.principal?.sub ?? "system";

    const existing = await periodCloseRepository.findByPeriod(validated.period);
    if (existing && existing.status === "closed") {
      throw AppError.badRequest(`Period ${validated.period} is already closed`);
    }

    const openBefore = await periodCloseRepository.findOpenBefore(validated.period);
    if (openBefore) {
      throw AppError.badRequest(
        `Cannot close ${validated.period}: period ${openBefore.period} is still open`,
      );
    }

    if (existing) {
      const updated = await periodCloseRepository.update({
        id: existing.id,
        data: {
          status: "closed",
          closedAt: new Date().toISOString(),
          closedBy: principalId,
          notes: validated.notes,
        },
      });
      await auditService.log(audit, "close:period", "period-close", existing.id, { period: validated.period });
      return updated as PeriodClose;
    }

    const record = await periodCloseRepository.create({
      data: {
        period: validated.period,
        status: "closed",
        closedAt: new Date().toISOString(),
        closedBy: principalId,
        notes: validated.notes,
      },
    });
    await auditService.log(audit, "close:period", "period-close", record.id, { period: validated.period });
    return record;
  }

  async open(input: OpenPeriodInput, audit: AuditContext): Promise<PeriodClose> {
    const validated = openPeriodSchema.parse(input);

    const existing = await periodCloseRepository.findByPeriod(validated.period);
    if (!existing || existing.status === "open") {
      throw AppError.badRequest(`Period ${validated.period} is not closed`);
    }

    const mostRecentClosed = await periodCloseRepository.findMostRecentClosed();
    if (!mostRecentClosed || mostRecentClosed.period !== validated.period) {
      throw AppError.badRequest("Only the most recently closed period can be reopened");
    }

    const updated = await periodCloseRepository.update({
      id: existing.id,
      data: {
        status: "open",
        closedAt: undefined,
        closedBy: undefined,
      },
    });
    await auditService.log(audit, "open:period", "period-close", existing.id, { period: validated.period });
    return updated as PeriodClose;
  }
}

export const periodCloseService = new PeriodCloseService();
