import { AppError } from "../../core/errors/app-error.js";
import { invoiceRepository } from "./invoice.repository.js";
import { invoiceCreateSchema, invoiceUpdateSchema, } from "./invoice.schema.js";
import { auditService } from "../../core/audit/audit.service.js";
import { productRepository } from "../products/product.repository.js";
import { partyRepository } from "../parties/party.repository.js";
import { warehouseRepository } from "../warehouses/warehouse.repository.js";
import { applyLineStock } from "../inventory/inventory.service.js";
import { stockItemRepository } from "../inventory/inventory.repository.js";
import { withTransaction } from "../../core/database/transaction.js";
const round2 = (n) => Math.round(n * 100) / 100;
export class InvoiceService {
    type;
    constructor(type) {
        this.type = type;
    }
    async assertParty(invoiceType, input) {
        if (invoiceType === "sales") {
            if (!input.customerId)
                throw AppError.badRequest("customerId is required for sales invoices");
            if (!(await partyRepository.findById(input.customerId)))
                throw AppError.badRequest("Customer not found");
        }
        else {
            if (!input.supplierId)
                throw AppError.badRequest("supplierId is required for purchase invoices");
            if (!(await partyRepository.findById(input.supplierId)))
                throw AppError.badRequest("Supplier not found");
        }
    }
    async computeLines(lines) {
        const result = [];
        for (const line of lines) {
            let productId = line.productId;
            let productName = line.productName;
            const product = line.productId ? await productRepository.findById(line.productId) : undefined;
            if (line.productId && !product)
                throw AppError.badRequest(`Product "${line.productId}" not found`);
            if (product) {
                productId = product.id;
                productName = product.name;
            }
            const gross = line.quantity * line.unitPrice - line.discount;
            const tax = gross * (line.taxRate / 100);
            const lineTotal = round2(gross + tax);
            result.push({
                productId,
                productName,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discount: line.discount,
                taxRate: line.taxRate,
                lineTotal,
            });
        }
        return result;
    }
    computeTotals(lines, discount) {
        const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.unitPrice - l.discount, 0));
        const tax = round2(lines.reduce((s, l) => s + l.lineTotal, 0) - subtotal);
        const total = round2(subtotal + tax - discount);
        return { subtotal, tax, total: Math.max(0, total) };
    }
    toEntityLine(line) {
        return { ...line, id: crypto.randomUUID() };
    }
    async create(input, audit) {
        const validated = invoiceCreateSchema.parse(input);
        await this.assertParty(this.type, validated);
        return withTransaction(async () => {
            const lines = await this.computeLines(validated.lines);
            const { subtotal, tax, total } = this.computeTotals(lines, validated.discount ?? 0);
            const number = await invoiceRepository.nextNumber(this.type);
            const principalId = audit.principal?.sub ?? "system";
            // For sales: reduce inventory stock.
            // For purchases: increase inventory stock.
            if (validated.warehouseId && !(await warehouseRepository.findById(validated.warehouseId))) {
                throw AppError.badRequest("Warehouse not found");
            }
            const invoice = await invoiceRepository.create({
                data: {
                    type: this.type,
                    number,
                    customerId: this.type === "sales" ? validated.customerId : undefined,
                    supplierId: this.type === "purchase" ? validated.supplierId : undefined,
                    invoiceDate: validated.invoiceDate,
                    dueDate: validated.dueDate,
                    warehouseId: validated.warehouseId,
                    lines: lines.map((l) => this.toEntityLine(l)),
                    subtotal,
                    discount: validated.discount ?? 0,
                    tax,
                    total,
                    paidAmount: 0,
                    status: "issued",
                    paymentMethod: validated.paymentMethod,
                    notes: validated.notes,
                    createdBy: principalId,
                },
            });
            const direction = this.type === "sales" ? "out" : "in";
            for (const line of lines) {
                if (line.productId) {
                    const product = await productRepository.findById(line.productId);
                    const cost = product?.purchasePrice ?? 0;
                    await applyLineStock(line.productId, validated.warehouseId, line.quantity, principalId, {
                        direction,
                        type: this.type === "sales" ? "sale" : "purchase",
                        referenceId: invoice.id,
                        cost: this.type === "purchase" ? cost : undefined,
                    });
                }
            }
            await auditService.log(audit, `create:${this.type}-invoice`, this.type, invoice.id, { number });
            return invoice;
        });
    }
    async update(id, input, audit) {
        const existing = await invoiceRepository.findById(id);
        if (!existing)
            throw AppError.notFound("invoice not found");
        if (existing.status === "void")
            throw AppError.conflict("Cannot update a void invoice");
        const validated = invoiceUpdateSchema.parse(input);
        return withTransaction(async () => {
            let lines = existing.lines;
            let { subtotal, tax, total } = existing;
            if (validated.lines) {
                // Restore stock from the original lines before applying the new ones.
                const principalId = audit.principal?.sub ?? "system";
                if (existing.warehouseId) {
                    for (const line of lines) {
                        if (line.productId) {
                            await applyLineStock(line.productId, existing.warehouseId, line.quantity, principalId, {
                                direction: this.type === "sales" ? "in" : "out",
                                type: "adjustment",
                                referenceId: existing.id,
                            });
                        }
                    }
                }
                const computed = await this.computeLines(validated.lines);
                lines = computed.map((l) => this.toEntityLine(l));
                const totals = this.computeTotals(computed, validated.discount ?? existing.discount);
                subtotal = totals.subtotal;
                tax = totals.tax;
                total = totals.total;
                if (existing.warehouseId) {
                    for (const line of computed) {
                        if (line.productId) {
                            await applyLineStock(line.productId, existing.warehouseId, line.quantity, principalId, {
                                direction: this.type === "sales" ? "out" : "in",
                                type: "adjustment",
                                referenceId: existing.id,
                            });
                        }
                    }
                }
            }
            const updated = await invoiceRepository.update({
                id,
                data: {
                    invoiceDate: validated.invoiceDate ?? existing.invoiceDate,
                    dueDate: validated.dueDate ?? existing.dueDate,
                    status: validated.status ?? existing.status,
                    notes: validated.notes ?? existing.notes,
                    paymentMethod: validated.paymentMethod ?? existing.paymentMethod,
                    lines,
                    subtotal,
                    tax,
                    total,
                    discount: validated.discount ?? existing.discount,
                },
            });
            await auditService.log(audit, `update:${this.type}-invoice`, this.type, id);
            return updated;
        });
    }
    async registerPayment(id, amount, method, audit) {
        const invoice = await invoiceRepository.findById(id);
        if (!invoice)
            throw AppError.notFound("invoice not found");
        if (invoice.status === "void")
            throw AppError.conflict("Cannot pay a void invoice");
        if (amount <= 0)
            throw AppError.badRequest("Payment amount must be positive");
        const paidAmount = round2(invoice.paidAmount + amount);
        if (paidAmount > invoice.total)
            throw AppError.badRequest("Payment exceeds invoice total");
        const status = paidAmount >= invoice.total ? "paid" : "partial";
        return withTransaction(async () => {
            const updated = await invoiceRepository.update({ id, data: { paidAmount, status, paymentMethod: method } });
            // Record a treasury transaction against the default cash account and update its balance.
            const { treasuryTransactionRepository, treasuryAccountRepository, } = await import("../treasury/treasury.repository.js");
            const account = await treasuryAccountRepository.findByName("Petty Cash")
                ?? await treasuryAccountRepository.findByName("Main Bank Account")
                ?? (await treasuryAccountRepository.findAll())[0];
            const accountId = account?.id ?? "";
            await treasuryTransactionRepository.create({
                data: {
                    accountId,
                    type: this.type === "sales" ? "income" : "expense",
                    amount,
                    category: this.type === "sales" ? "customer-payment" : "supplier-payment",
                    partyType: this.type === "sales" ? "customer" : "supplier",
                    partyId: (this.type === "sales" ? invoice.customerId : invoice.supplierId) ?? undefined,
                    reference: invoice.number,
                    referenceId: invoice.id,
                    description: `${this.type === "sales" ? "Payment received" : "Payment made"} — ${invoice.number}`,
                    date: new Date().toISOString(),
                    createdBy: audit.principal?.sub ?? "system",
                },
            });
            if (account) {
                const delta = this.type === "sales" ? amount : -amount;
                await treasuryAccountRepository.update({
                    id: account.id,
                    data: { balance: round2(account.balance + delta) },
                });
            }
            await auditService.log(audit, `pay:${this.type}-invoice`, this.type, id, { amount });
            return updated;
        });
    }
    async void(id, audit) {
        const invoice = await invoiceRepository.findById(id);
        if (!invoice)
            throw AppError.notFound("invoice not found");
        if (invoice.status === "void")
            return invoice;
        return withTransaction(async () => {
            // Reverse stock effects.
            const principalId = audit.principal?.sub ?? "system";
            if (invoice.warehouseId) {
                for (const line of invoice.lines) {
                    if (line.productId) {
                        await applyLineStock(line.productId, invoice.warehouseId, line.quantity, principalId, {
                            direction: this.type === "sales" ? "in" : "out",
                            type: "return",
                            referenceId: invoice.id,
                            allowNegative: this.type === "purchase",
                        });
                    }
                }
            }
            const updated = await invoiceRepository.update({ id, data: { status: "void" } });
            await auditService.log(audit, `void:${this.type}-invoice`, this.type, id);
            return updated;
        });
    }
    async getById(id) {
        const invoice = await invoiceRepository.findById(id);
        if (!invoice)
            throw AppError.notFound("invoice not found");
        return invoice;
    }
    async list(options) {
        const result = await invoiceRepository.list({
            ...options,
            filters: { ...(options.filters ?? {}), type: [this.type] },
            searchFields: ["number", "customerId", "supplierId"],
        });
        return result;
    }
    /** Enrich invoice with party + warehouse names for the frontend. */
    async enrich(invoice) {
        const customer = invoice.customerId ? await partyRepository.findById(invoice.customerId) : undefined;
        const supplier = invoice.supplierId ? await partyRepository.findById(invoice.supplierId) : undefined;
        const warehouse = invoice.warehouseId ? await warehouseRepository.findById(invoice.warehouseId) : undefined;
        const balance = round2(invoice.total - invoice.paidAmount);
        return {
            ...invoice,
            customerName: customer?.name,
            supplierName: supplier?.name,
            warehouseName: warehouse?.name,
            balance,
        };
    }
}
export function createInvoiceService(type) {
    return new InvoiceService(type);
}
export { stockItemRepository };
