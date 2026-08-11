import { PrismaRepository } from "../../core/repository/base-repository.js";
/** Map user-facing payment methods to Prisma enum values. */
const PAY_TO_DB = {
    cash: "cash",
    bank: "bankTransfer",
    bankTransfer: "bankTransfer",
    card: "card",
    check: "check",
    credit: "credit",
    other: "other",
};
const PAY_FROM_DB = {
    cash: "cash",
    bankTransfer: "bank",
    card: "card",
    check: "check",
    credit: "credit",
    other: "other",
};
export class InvoiceRepository extends PrismaRepository {
    model = "invoice";
    dateFields = ["invoiceDate", "dueDate"];
    include = { lines: true };
    toEntity(row) {
        const rawLines = row.lines ?? [];
        return {
            id: String(row.id),
            type: row.type,
            number: String(row.number),
            customerId: row.customerId ? String(row.customerId) : undefined,
            supplierId: row.supplierId ? String(row.supplierId) : undefined,
            invoiceDate: this.toISO(row.invoiceDate),
            dueDate: this.toISO(row.dueDate),
            warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
            lines: rawLines.map((l) => this.toLine(l)),
            subtotal: Number(row.subtotal),
            discount: Number(row.discount),
            tax: Number(row.tax),
            total: Number(row.total),
            paidAmount: Number(row.paidAmount),
            status: row.status,
            paymentMethod: row.paymentMethod ? PAY_FROM_DB[String(row.paymentMethod)] ?? String(row.paymentMethod) : undefined,
            notes: row.notes ? String(row.notes) : undefined,
            createdBy: String(row.createdBy),
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    toLine(l) {
        return {
            id: String(l.id),
            productId: l.productId ? String(l.productId) : undefined,
            productName: String(l.productName),
            description: l.description ? String(l.description) : undefined,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            discount: Number(l.discount),
            taxRate: Number(l.taxRate),
            lineTotal: Number(l.lineTotal),
        };
    }
    toLineCreate(l) {
        return {
            productId: l.productId ?? null,
            productName: l.productName,
            description: l.description ?? null,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            taxRate: l.taxRate,
            lineTotal: l.lineTotal,
        };
    }
    toCreateData(data) {
        const { lines, paymentMethod, ...rest } = data;
        return {
            ...this.convertDates(rest),
            ...(paymentMethod ? { paymentMethod: PAY_TO_DB[paymentMethod] ?? "other" } : {}),
            lines: { create: (lines ?? []).map((l) => this.toLineCreate(l)) },
        };
    }
    toUpdateData(data) {
        const { lines, paymentMethod, ...rest } = data;
        return {
            ...this.convertDates(rest),
            ...(paymentMethod !== undefined ? { paymentMethod: paymentMethod ? PAY_TO_DB[paymentMethod] ?? "other" : null } : {}),
            ...(lines !== undefined ? { lines: { deleteMany: {}, create: lines.map((l) => this.toLineCreate(l)) } } : {}),
        };
    }
    async findByNumber(number) {
        const rows = await this.delegate.findFirst({
            where: { ...this.baseWhere(), number },
            include: this.include,
        });
        return rows ? this.toEntity(rows) : undefined;
    }
    async byType(type) {
        const all = await this.findAll();
        return all.filter((inv) => inv.type === type && inv.status !== "void");
    }
    async nextNumber(type) {
        const prefix = type === "sales" ? "INV" : "PUR";
        const count = await this.delegate.count({ where: { ...this.baseWhere(), type } });
        return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    }
}
export const invoiceRepository = new InvoiceRepository();
