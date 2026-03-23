import PDFDocument from 'pdfkit';

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
        }>;
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

export async function generateInvoicePDF(invoiceData: InvoiceData): Promise<Buffer> {
	return new Promise<Buffer>((resolve, reject) => {
		try {
			const company = invoiceData.company || {
        name: 'pagz',
        address: 'Company Address',
        phone: '+91 1234567890',
        email: 'info@pagz.com',
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

			const pageWidth = doc.page.width;
			const margin = 40;
			const contentWidth = pageWidth - margin * 2;

			const currency = (value: number) => `Rs ${Number(value || 0).toFixed(2)}`;
			const line = (y: number) => {
				doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor('#D0D0D0').lineWidth(1).stroke();
			};

			doc.fontSize(24).fillColor('#111').text(company.name, margin, 36, { width: contentWidth * 0.6 });
			doc.fontSize(20).fillColor('#222').text('INVOICE', margin + contentWidth * 0.6, 40, {
				width: contentWidth * 0.4,
				align: 'right',
			});
			doc.moveDown(0.2);
			doc.fontSize(10).fillColor('#444').text(company.address, margin, 68, { width: contentWidth * 0.6 });
			doc.text(`Phone: ${company.phone}`, margin, 82, { width: contentWidth * 0.6 });
			doc.text(`Email: ${company.email}`, margin, 96, { width: contentWidth * 0.6 });
			if (company.gstin) {
				doc.text(`GSTIN: ${company.gstin}`, margin, 110, { width: contentWidth * 0.6 });
			}

			doc.fontSize(10).fillColor('#222').text(`Invoice No: ${invoiceData.invoiceNumber}`, margin + contentWidth * 0.6, 72, {
				width: contentWidth * 0.4,
				align: 'right',
			});
			doc.text(`Date: ${invoiceData.orderDate}`, margin + contentWidth * 0.6, 86, {
				width: contentWidth * 0.4,
				align: 'right',
			});
			doc.text(`Order ID: ${invoiceData.orderId.slice(0, 8).toUpperCase()}`, margin + contentWidth * 0.6, 100, {
				width: contentWidth * 0.4,
				align: 'right',
			});

			line(132);

			let y = 146;
			doc.fontSize(11).fillColor('#111').text('Bill To', margin, y);
			doc.text('Ship To', margin + contentWidth / 2, y);
			y += 16;

			doc.fontSize(10).fillColor('#333').text(invoiceData.customer.name, margin, y, { width: contentWidth / 2 - 10 });
			doc.text(invoiceData.customer.email, margin, y + 14, { width: contentWidth / 2 - 10 });
			if (invoiceData.customer.phone) {
				doc.text(invoiceData.customer.phone, margin, y + 28, { width: contentWidth / 2 - 10 });
			}

			doc.text(invoiceData.shippingAddress.street, margin + contentWidth / 2, y, { width: contentWidth / 2 - 10 });
			doc.text(
				`${invoiceData.shippingAddress.city}, ${invoiceData.shippingAddress.state} ${invoiceData.shippingAddress.zipCode}`,
				margin + contentWidth / 2,
				y + 14,
				{ width: contentWidth / 2 - 10 }
			);
			doc.text(invoiceData.shippingAddress.country, margin + contentWidth / 2, y + 28, { width: contentWidth / 2 - 10 });

			y = y + 52;
			line(y);
			y += 10;

			const col = {
				item: margin,
				qty: margin + contentWidth * 0.53,
				unitPrice: margin + contentWidth * 0.66,
				total: margin + contentWidth * 0.82,
			};

			doc.fontSize(10).fillColor('#111').text('Item', col.item, y);
			doc.text('Qty', col.qty, y, { width: 40, align: 'left' });
			doc.text('Unit Price', col.unitPrice, y, { width: 90, align: 'right' });
			doc.text('Total', col.total, y, { width: contentWidth - (col.total - margin), align: 'right' });
			y += 14;
			line(y);
			y += 8;

			const ensurePageSpace = (required: number) => {
				if (y + required <= doc.page.height - 80) return;
				doc.addPage();
				y = 50;
			};

			for (const item of invoiceData.items) {
				const addons = item.addons || [];
				const addonsTotal = addons.reduce((sum, addon) => sum + addon.price, 0);
				const itemTotalWithAddons = item.total + addonsTotal;
				const rowHeight = 14 + addons.length * 12 + 4;
				ensurePageSpace(rowHeight + 10);

				const itemTitle = item.variant ? `${item.name} (${item.variant})` : item.name;
				doc.fontSize(10).fillColor('#222').text(itemTitle, col.item, y, {
					width: col.qty - col.item - 12,
				});
				doc.text(String(item.quantity), col.qty, y, { width: 40, align: 'left' });
				doc.text(currency(item.price), col.unitPrice, y, { width: 90, align: 'right' });
				doc.text(currency(itemTotalWithAddons), col.total, y, {
					width: contentWidth - (col.total - margin),
					align: 'right',
				});
				y += 14;

				for (const addon of addons) {
					doc.fontSize(9).fillColor('#666').text(`- Addon: ${addon.name}`, col.item + 10, y, {
						width: col.qty - col.item - 22,
					});
					doc.text(currency(addon.price), col.total, y, {
						width: contentWidth - (col.total - margin),
						align: 'right',
					});
					y += 12;
				}

				doc.strokeColor('#EFEFEF').moveTo(margin, y + 2).lineTo(pageWidth - margin, y + 2).stroke();
				y += 8;
			}

			ensurePageSpace(130);
			y += 8;
			const summaryX = margin + contentWidth * 0.54;
			const summaryWidth = contentWidth * 0.46;
			const summaryRow = (label: string, value: string, color = '#333', bold = false) => {
				doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(color);
				doc.text(label, summaryX, y, { width: summaryWidth * 0.55, align: 'left' });
				doc.text(value, summaryX + summaryWidth * 0.55, y, { width: summaryWidth * 0.45, align: 'right' });
				y += 14;
			};

			summaryRow('Base Price Subtotal', currency(invoiceData.billing.baseSubtotal));
			if (invoiceData.billing.addonsSubtotal > 0) {
				summaryRow('Addons Subtotal', currency(invoiceData.billing.addonsSubtotal));
			}
			summaryRow('Subtotal', currency(invoiceData.billing.subtotal), '#111', true);
			if (invoiceData.billing.discount > 0) {
				summaryRow('Discount', `- ${currency(invoiceData.billing.discount)}`, '#0F7A37');
			}
			if (invoiceData.billing.shipping > 0) {
				summaryRow('Shipping', currency(invoiceData.billing.shipping));
			}
			if ((invoiceData.billing.tax || 0) > 0) {
				summaryRow('Tax (GST)', currency(invoiceData.billing.tax || 0));
			}
			doc.strokeColor('#D0D0D0').moveTo(summaryX, y + 2).lineTo(summaryX + summaryWidth, y + 2).stroke();
			y += 8;
			summaryRow('Total Amount', currency(invoiceData.billing.total), '#111', true);

			y += 12;
			ensurePageSpace(60);
			doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text('Payment Information', margin, y);
			y += 16;
			doc.font('Helvetica').fontSize(10).fillColor('#333').text(`Method: ${invoiceData.payment.method}`, margin, y);
			y += 14;
			doc.text(`Status: ${invoiceData.payment.status}`, margin, y);
			y += 14;
			if (invoiceData.payment.transactionId) {
				doc.text(`Transaction ID: ${invoiceData.payment.transactionId}`, margin, y);
				y += 14;
			}

			// Always render closing note on the first page so it never shifts to a later page.
			const pageRange = doc.bufferedPageRange();
			if (pageRange.count > 0) {
				doc.switchToPage(pageRange.start);
				const footerY = doc.page.height - 40;
				doc.fontSize(9).fillColor('#666').text('Thank you for your business!', margin, footerY, {
					width: contentWidth,
					align: 'center',
				});
			}

			doc.end();
		} catch (err) {
			reject(new Error(`[PDF_GENERATION_FAILED] ${err instanceof Error ? err.message : String(err)}`));
		}
	});
}
