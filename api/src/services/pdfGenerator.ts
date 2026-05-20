import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

export interface InvoiceData {
    invoiceNumber: string;
    orderDate: string;
    orderId: string;
    customer: {
        name: string;
        email: string;
        phone?: string;
    };
    shippingAddress: {
        /** Per-address recipient name (falls back to customer.name on render). */
        name?: string | null;
        /** Per-address recipient phone (falls back to customer.phone). */
        phone?: string | null;
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    items: Array<{
        name: string;
        variant?: string;
        quantity: number;
        price: number;
        total: number;
        addons?: Array<{
            name: string;
            price: number;
            /** Phase 3 of per-file addon pricing — per-file sub-rows
             *  rendered underneath this addon line when the rule has
             *  `perFileEvaluation` on and 2+ files were uploaded.
             *  Single-entry breakdowns collapse to the parent line. */
            breakdown?: Array<{
                /** Display filename (basename of the FTP url) — orderController
                 *  pre-resolves it so the PDF generator doesn't need to know
                 *  about FTP paths. */
                label: string;
                /** Optional page count hint for the sub-row (`500p`). */
                pageCount?: number;
                price: number;
            }>;
        }>;
        /** Persisted breakdown rows from `OrderItem.metadata.priceBreakdown`,
         *  e.g. `Base Price (242 pages × 1 copies) → 266.20`. Rendered with
         *  per-row math so the invoice matches the order detail UI. */
        priceBreakdown?: Array<{ label: string; value: number }>;
    }>;
    billing: {
        baseSubtotal: number;
        addonsSubtotal: number;
        subtotal: number;
        discount: number;
        shipping: number;
        tax?: number;
        total: number;
    };
    payment: {
        method: string;
        status: string;
        transactionId?: string;
    };
    company?: {
        name: string;
        address: string;
        phone: string;
        email: string;
        gstin?: string;
    };
}

/**
 * Resolve the brand logo (mirrors web/public/images/logo.png).
 * Tries multiple paths so the same code works in dev (Bun runs `src/`)
 * and prod (tsup outputs to `dist/`). Returns null if the asset can't
 * be located so PDF generation can fall back to a text wordmark.
 */
let cachedLogoBuffer: Buffer | null | undefined;
function loadLogoBuffer(): Buffer | null {
    if (cachedLogoBuffer !== undefined) return cachedLogoBuffer;
    const candidates = [
        path.resolve(process.cwd(), 'src/assets/logo.png'),
        path.resolve(process.cwd(), 'dist/assets/logo.png'),
        path.resolve(process.cwd(), 'assets/logo.png'),
        path.resolve(process.cwd(), 'api/src/assets/logo.png'),
    ];
    for (const p of candidates) {
        try {
            const buf = fs.readFileSync(p);
            cachedLogoBuffer = buf;
            return buf;
        } catch {
            // try next
        }
    }
    cachedLogoBuffer = null;
    return null;
}

/** Strip leading "Both Side: ..." style info rows from a breakdown — they're
 *  zero-value annotations meant for inline display, not for the invoice. */
function isInfoRow(label: string, value: number): boolean {
    if (value > 0) return false;
    const lower = String(label).toLowerCase();
    return lower.includes('→') || lower.includes('both side') || lower.includes('half page');
}

/**
 * Pull the effective qty and per-unit rate out of a Base breakdown row
 * (e.g. `Base Price (242 pages × 1 copies)` → ₹266.20). Mirrors the
 * client-side derivation in `web/app/(account)/orders/[id]/page.tsx` so
 * the invoice header matches the order detail UI.
 *
 * Stored `OrderItem.price` × `OrderItem.quantity` can lie for half-page
 * jobs (price = half-rate, qty = raw pages — skips the ceil() rounding
 * the rule does). Trusting the breakdown's parsed multiplier instead
 * gives the rule's actual per-page rate.
 */
function deriveUnitFromBaseRow(
    breakdown: Array<{ label: string; value: number }> | undefined,
    fallback: { unit: number; quantity: number }
): { unit: number; quantity: number } {
    if (!breakdown || breakdown.length === 0) return fallback;
    const base = breakdown.find((row) =>
        typeof row.label === 'string' && row.label.toLowerCase().startsWith('base')
    );
    if (!base) return fallback;
    const label = String(base.label);
    const pages = Number(label.match(/(\d+(?:\.\d+)?)\s*pages?\b/i)?.[1] ?? 0);
    const copies = Number(label.match(/(\d+(?:\.\d+)?)\s*cop(?:y|ies)\b/i)?.[1] ?? 0);
    const files = Number(label.match(/(\d+(?:\.\d+)?)\s*files?\b/i)?.[1] ?? 0);
    let multiplier = 1;
    if (pages > 0) multiplier *= pages;
    if (copies > 0) multiplier *= copies;
    if (multiplier === 1 && files > 0) multiplier = files;
    if (multiplier <= 1) return fallback;
    const unit = Number(base.value) / multiplier;
    return {
        unit: Number.isFinite(unit) ? unit : fallback.unit,
        quantity: multiplier,
    };
}

export async function generateInvoicePDF(invoiceData: InvoiceData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        try {
            const company = invoiceData.company || {
                name: 'PAGZ',
                address: 'Company Address',
                phone: '+91 1234567890',
                email: 'info@pagz.in',
            };

            const doc = new PDFDocument({
                size: 'A4',
                margin: 40,
                bufferPages: true,
                info: {
                    Title: `Invoice ${invoiceData.invoiceNumber}`,
                    Author: company.name,
                },
            });

            const chunks: Buffer[] = [];
            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('error', (err: unknown) => reject(new Error(`[PDF_GENERATION_FAILED] ${String(err)}`)));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // ── Layout constants ─────────────────────────────────────────
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const margin = 40;
            const contentWidth = pageWidth - margin * 2;
            const colors = {
                ink: '#0F172A',         // primary text (slate-900)
                muted: '#64748B',       // secondary text (slate-500)
                subtle: '#94A3B8',      // tertiary (slate-400)
                line: '#E2E8F0',        // dividers (slate-200)
                accent: '#1EADD8',      // brand blue
                discount: '#16A34A',    // green-600
                surface: '#F8FAFC',     // slate-50
            };

            const currency = (value: number) =>
                `Rs ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            const hr = (y: number, color = colors.line) => {
                doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor(color).lineWidth(0.6).stroke();
            };

            // ── Header: logo + INVOICE meta ──────────────────────────────
            const logoBuf = loadLogoBuffer();
            const headerTop = 36;
            if (logoBuf) {
                try {
                    doc.image(logoBuf, margin, headerTop, { fit: [140, 40] });
                } catch {
                    doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.ink).text(company.name, margin, headerTop);
                }
            } else {
                doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.ink).text(company.name, margin, headerTop);
            }

            const metaX = margin + contentWidth * 0.55;
            const metaW = contentWidth * 0.45;
            doc.font('Helvetica-Bold').fontSize(20).fillColor(colors.ink)
                .text('INVOICE', metaX, headerTop, { width: metaW, align: 'right' });
            doc.font('Helvetica').fontSize(9).fillColor(colors.muted)
                .text(`Invoice No.  ${invoiceData.invoiceNumber}`, metaX, headerTop + 26, { width: metaW, align: 'right' });
            doc.text(`Order ID  ${invoiceData.orderId.slice(0, 8).toUpperCase()}`, metaX, headerTop + 40, { width: metaW, align: 'right' });
            doc.text(`Date  ${invoiceData.orderDate}`, metaX, headerTop + 54, { width: metaW, align: 'right' });

            // Company contact strip below the logo (subtle)
            const contactY = headerTop + 50;
            doc.font('Helvetica').fontSize(8.5).fillColor(colors.muted)
                .text(company.address, margin, contactY, { width: contentWidth * 0.55 });
            const contactBits: string[] = [];
            if (company.phone) contactBits.push(company.phone);
            if (company.email) contactBits.push(company.email);
            if (company.gstin) contactBits.push(`GSTIN ${company.gstin}`);
            if (contactBits.length) {
                doc.text(contactBits.join('  ·  '), margin, contactY + 12, { width: contentWidth * 0.55 });
            }

            let y = Math.max(contactY + 30, headerTop + 80);
            hr(y);
            y += 16;

            // ── Bill To / Ship To ────────────────────────────────────────
            const colW = (contentWidth - 16) / 2;
            const billX = margin;
            const shipX = margin + colW + 16;

            doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.subtle);
            doc.text('BILL TO', billX, y);
            doc.text('SHIP TO', shipX, y);
            y += 14;

            // Two parallel columns. Use `doc.heightOfString` per line and
            // advance each column's Y by the actual rendered height, so a
            // long wrapping street doesn't get overlapped by the city /
            // state / zip line below it. Each column tracks its own Y.
            const writeLine = (
                text: string,
                x: number,
                colY: number,
                opts: { font: 'Helvetica' | 'Helvetica-Bold'; size: number; color: string },
            ): number => {
                if (!text) return colY;
                doc.font(opts.font).fontSize(opts.size).fillColor(opts.color);
                const h = doc.heightOfString(text, { width: colW });
                doc.text(text, x, colY, { width: colW });
                return colY + h + 2;
            };

            const nameOpts = { font: 'Helvetica-Bold' as const, size: 11, color: colors.ink };
            const lineOpts = { font: 'Helvetica' as const, size: 9.5, color: colors.muted };

            // Bill column
            let billY = y;
            billY = writeLine(invoiceData.customer.name, billX, billY, nameOpts);
            billY += 4;
            billY = writeLine(invoiceData.customer.email, billX, billY, lineOpts);
            if (invoiceData.customer.phone) {
                billY = writeLine(invoiceData.customer.phone, billX, billY, lineOpts);
            }

            // Ship column — prefer the per-address recipient name + phone
            // when present so the courier sees the right contact for THIS
            // delivery; fall back to the account-level customer fields.
            let shipY = y;
            const shipName = invoiceData.shippingAddress.name || invoiceData.customer.name;
            shipY = writeLine(shipName, shipX, shipY, nameOpts);
            shipY += 4;
            const shipPhone = invoiceData.shippingAddress.phone || invoiceData.customer.phone;
            if (shipPhone) {
                shipY = writeLine(shipPhone, shipX, shipY, lineOpts);
            }
            const shipLines = [
                invoiceData.shippingAddress.street,
                `${invoiceData.shippingAddress.city}, ${invoiceData.shippingAddress.state} ${invoiceData.shippingAddress.zipCode}`.trim(),
                invoiceData.shippingAddress.country,
            ].filter((s) => s && s.trim().length > 0);
            for (const line of shipLines) {
                shipY = writeLine(line, shipX, shipY, lineOpts);
            }

            y = Math.max(billY, shipY) + 12;
            hr(y);
            y += 16;

            // ── Items section ────────────────────────────────────────────
            // Reserve only enough room for the bottom footer (~32 px from
            // the page edge). The previous 80 px reserve forced a fresh
            // page even when there was 60–70 px of unused real estate
            // after the summary, leaving the footer alone on page 2.
            const FOOTER_RESERVE = 36;
            const ensurePageSpace = (required: number) => {
                if (y + required <= pageHeight - FOOTER_RESERVE) return;
                doc.addPage();
                y = 50;
            };

            doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.subtle).text('ORDER ITEMS', margin, y);
            y += 16;

            for (let idx = 0; idx < invoiceData.items.length; idx++) {
                const item = invoiceData.items[idx]!;
                const breakdown = (item.priceBreakdown ?? []).filter(
                    (row) => !isInfoRow(row.label, Number(row.value)),
                );
                const itemTotal = breakdown.length > 0
                    ? breakdown.reduce((sum, row) => sum + (Number(row.value) > 0 ? Number(row.value) : 0), 0)
                    : item.total + (item.addons || []).reduce((sum, a) => sum + a.price, 0);

                // Account for Phase 3 per-file sub-rows under each addon
                // (one extra ~12px row per sub-entry). The renderer calls
                // `ensurePageSpace` again per sub-row so this is just a
                // hint that keeps the title + Qty/Unit block grouped with
                // the first few breakdown rows.
                const addonSubRowCount = (item.addons || []).reduce(
                    (sum, a) => sum + (a.breakdown?.length ?? 0),
                    0,
                );
                ensurePageSpace(
                    60 + breakdown.length * 14 + (item.addons?.length || 0) * 12
                    + addonSubRowCount * 12,
                );

                const itemTitle = item.variant ? `${item.name} (${item.variant})` : item.name;
                doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.ink);
                doc.text(itemTitle, margin, y, { width: contentWidth * 0.7 });
                doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.accent);
                doc.text(currency(itemTotal), margin + contentWidth * 0.7, y, {
                    width: contentWidth * 0.3,
                    align: 'right',
                });
                y += 16;

                // Show the rule's actual per-unit rate + effective qty
                // derived from the breakdown's Base row. `item.price` /
                // `item.quantity` can disagree with the breakdown for
                // half-page orders (stored as half-rate × raw-pages).
                const { unit: displayUnit, quantity: displayQty } = deriveUnitFromBaseRow(
                    item.priceBreakdown,
                    { unit: Number(item.price) || 0, quantity: Number(item.quantity) || 0 },
                );
                doc.font('Helvetica').fontSize(9).fillColor(colors.muted);
                doc.text(`Qty: ${displayQty}  ·  Unit: ${currency(displayUnit)}`, margin, y, {
                    width: contentWidth,
                });
                y += 14;

                // Phase 3 — render per-file sub-rows for any addon with
                // `perFileEvaluation` on and 2+ uploaded files. Reused by
                // both the priceBreakdown path (sub-rows appear after the
                // matching `Addon: <name>` row) and the legacy fallback.
                const renderAddonSubRows = (
                    subRows: NonNullable<typeof item.addons>[number]['breakdown'],
                ) => {
                    if (!subRows || subRows.length === 0) return;
                    for (const sub of subRows) {
                        ensurePageSpace(12);
                        const pagesHint = sub.pageCount && sub.pageCount > 0
                            ? ` (${sub.pageCount} pages)`
                            : '';
                        doc.font('Helvetica').fontSize(8.5).fillColor(colors.muted);
                        doc.text(`  └ ${sub.label}${pagesHint}`, margin + 12, y, {
                            width: contentWidth - 100,
                        });
                        doc.font('Helvetica').fontSize(8.5).fillColor(colors.ink);
                        doc.text(currency(sub.price), margin, y, {
                            width: contentWidth - 8,
                            align: 'right',
                        });
                        y += 12;
                    }
                };

                if (breakdown.length > 0) {
                    // Rows from server-stored priceBreakdown so the invoice
                    // matches the customer-facing order detail screen. When
                    // a row label matches one of the order's addons by name
                    // (`Addon: <specs>` prefix), inject the per-file
                    // sub-rows right after it so the breakdown reads
                    // top-down end-to-end.
                    const addonByName = new Map(
                        (item.addons || []).map((a) => [a.name.toLowerCase(), a]),
                    );
                    for (const row of breakdown) {
                        ensurePageSpace(14);
                        doc.font('Helvetica').fontSize(9.5).fillColor(colors.muted);
                        doc.text(row.label, margin + 8, y, { width: contentWidth - 90 });
                        if (Number(row.value) > 0) {
                            doc.font('Helvetica').fontSize(9.5).fillColor(colors.ink);
                            doc.text(currency(Number(row.value)), margin, y, {
                                width: contentWidth - 8,
                                align: 'right',
                            });
                        }
                        y += 14;
                        const lower = row.label.toLowerCase();
                        // Match either explicit `addon: <name>` or any row
                        // containing the addon's display name. Defensive
                        // because cart/order writers historically used a
                        // few different labels.
                        const matched = Array.from(addonByName.entries()).find(
                            ([key]) => lower.includes(key),
                        );
                        if (matched && matched[1].breakdown && matched[1].breakdown.length > 0) {
                            renderAddonSubRows(matched[1].breakdown);
                        }
                    }
                } else {
                    // Fallback: the legacy item.total + addons list path.
                    doc.font('Helvetica').fontSize(9.5).fillColor(colors.muted);
                    doc.text('Base Price', margin + 8, y, { width: contentWidth - 90 });
                    doc.font('Helvetica').fontSize(9.5).fillColor(colors.ink);
                    doc.text(currency(item.total), margin, y, { width: contentWidth - 8, align: 'right' });
                    y += 14;
                    for (const addon of item.addons || []) {
                        ensurePageSpace(12);
                        doc.font('Helvetica').fontSize(9).fillColor(colors.muted);
                        doc.text(`Addon · ${addon.name}`, margin + 8, y, { width: contentWidth - 90 });
                        doc.font('Helvetica').fontSize(9).fillColor(colors.ink);
                        doc.text(currency(addon.price), margin, y, { width: contentWidth - 8, align: 'right' });
                        y += 12;
                        renderAddonSubRows(addon.breakdown);
                    }
                }

                y += 4;
                doc.strokeColor(colors.line).lineWidth(0.5).moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
                y += 12;
            }

            // ── Summary ──────────────────────────────────────────────────
            // Estimate the actual space the summary needs based on which
            // optional rows fire. Earlier 150 px reservation forced a
            // page break even when 100 px would have been enough,
            // pushing the payment block + footer to a fresh page-2.
            const summaryRowsCount = 2 // Base Subtotal + Subtotal
                + (invoiceData.billing.addonsSubtotal > 0 ? 1 : 0)
                + (invoiceData.billing.discount > 0 ? 1 : 0)
                + (invoiceData.billing.shipping > 0 ? 1 : 0)
                + ((invoiceData.billing.tax || 0) > 0 ? 1 : 0);
            const summaryHeightEstimate = summaryRowsCount * 14 + 18 + 14; // emphasized total + dividers
            ensurePageSpace(summaryHeightEstimate);
            const summaryX = margin + contentWidth * 0.55;
            const summaryW = contentWidth * 0.45;
            const summaryRow = (label: string, value: string, opts: { color?: string; bold?: boolean; emphasize?: boolean } = {}) => {
                const color = opts.color ?? colors.ink;
                doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
                doc.fontSize(opts.emphasize ? 11 : 9.5).fillColor(color);
                doc.text(label, summaryX, y, { width: summaryW * 0.55, align: 'left' });
                doc.text(value, summaryX + summaryW * 0.55, y, { width: summaryW * 0.45, align: 'right' });
                y += opts.emphasize ? 18 : 14;
            };

            summaryRow('Base Subtotal', currency(invoiceData.billing.baseSubtotal), { color: colors.muted });
            if (invoiceData.billing.addonsSubtotal > 0) {
                summaryRow('Addons', currency(invoiceData.billing.addonsSubtotal), { color: colors.muted });
            }
            doc.strokeColor(colors.line).lineWidth(0.5).moveTo(summaryX, y).lineTo(summaryX + summaryW, y).stroke();
            y += 6;
            summaryRow('Subtotal', currency(invoiceData.billing.subtotal), { bold: true });
            if (invoiceData.billing.discount > 0) {
                summaryRow('Discount', `- ${currency(invoiceData.billing.discount)}`, { color: colors.discount });
            }
            if (invoiceData.billing.shipping > 0) {
                summaryRow('Shipping', currency(invoiceData.billing.shipping), { color: colors.muted });
            }
            if ((invoiceData.billing.tax || 0) > 0) {
                summaryRow('Tax (GST)', currency(invoiceData.billing.tax || 0), { color: colors.muted });
            }
            doc.strokeColor(colors.ink).lineWidth(1).moveTo(summaryX, y).lineTo(summaryX + summaryW, y).stroke();
            y += 8;
            summaryRow('Total Amount', currency(invoiceData.billing.total), { bold: true, emphasize: true, color: colors.accent });

            // ── Payment block ────────────────────────────────────────────
            y += 8;
            // Just the lines we'll draw — heading + 2 mandatory rows + an
            // optional transaction id. Reserving a flat 70 px earlier
            // could trigger an unneeded page break.
            const paymentHeight = 14 + 13 + 13 + (invoiceData.payment.transactionId ? 13 : 0);
            ensurePageSpace(paymentHeight);
            doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.subtle).text('PAYMENT', margin, y);
            y += 14;
            doc.font('Helvetica').fontSize(9.5).fillColor(colors.ink);
            doc.text(`Method: ${invoiceData.payment.method}`, margin, y);
            y += 13;
            doc.text(`Status: ${invoiceData.payment.status}`, margin, y);
            y += 13;
            if (invoiceData.payment.transactionId) {
                doc.font('Helvetica').fontSize(9).fillColor(colors.muted);
                doc.text(`Transaction ID: ${invoiceData.payment.transactionId}`, margin, y, { width: contentWidth });
                y += 13;
            }

            // ── Footer ───────────────────────────────────────────────────
            // Render only on the LAST page (the page where content finished).
            // Earlier code looped every page and re-stamped the footer, so
            // a single-page invoice with a slim payment block sometimes
            // had the footer alone on a fresh page-2 even though page-1
            // had room. Anchor at a fixed offset from the page edge.
            const pageRange = doc.bufferedPageRange();
            if (pageRange.count > 0) {
                const lastPageIdx = pageRange.start + pageRange.count - 1;
                doc.switchToPage(lastPageIdx);
                const footerY = pageHeight - 28;
                doc.font('Helvetica').fontSize(8.5).fillColor(colors.muted).text(
                    `${company.name}  ·  Thank you for your order`,
                    margin,
                    footerY,
                    { width: contentWidth, align: 'center' },
                );
            }

            doc.end();
        } catch (err) {
            reject(new Error(`[PDF_GENERATION_FAILED] ${err instanceof Error ? err.message : String(err)}`));
        }
    });
}
