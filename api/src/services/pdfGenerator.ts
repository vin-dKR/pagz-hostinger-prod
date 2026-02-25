import puppeteer from 'puppeteer';

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
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // For production
    });

    try {
        const page = await browser.newPage();
        
        const html = generateInvoiceHTML(invoiceData);
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm',
            },
        });

        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
}

function generateInvoiceHTML(data: InvoiceData): string {
    const company = data.company || {
        name: 'pagz',
        address: 'Company Address',
        phone: '+91 1234567890',
        email: 'info@pagz.com',
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${data.invoiceNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-size: 12px;
            color: #0F1111;
            line-height: 1.6;
            background: #FFFFFF;
        }
        .invoice-container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20mm;
            background: white;
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #FF9900;
        }
        .company-info {
            flex: 1;
        }
        .company-info h1 {
            font-size: 28px;
            margin-bottom: 10px;
            color: #FF9900;
            font-weight: bold;
            letter-spacing: -0.5px;
        }
        .company-info p {
            margin: 3px 0;
            color: #666;
            font-size: 11px;
        }
        .invoice-info {
            text-align: right;
        }
        .invoice-info h2 {
            font-size: 28px;
            margin-bottom: 10px;
            color: #333;
        }
        .invoice-info p {
            margin: 5px 0;
            color: #666;
        }
        .invoice-number {
            font-size: 14px;
            font-weight: bold;
            color: #333;
        }
        .details-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .detail-box {
            background: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
        }
        .detail-box h3 {
            font-size: 14px;
            margin-bottom: 10px;
            color: #333;
            border-bottom: 2px solid #ddd;
            padding-bottom: 5px;
        }
        .detail-box p {
            margin: 5px 0;
            font-size: 11px;
            color: #555;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        thead {
            background: #232F3E;
            color: white;
        }
        th {
            padding: 12px;
            text-align: left;
            font-size: 11px;
            font-weight: bold;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #E7E7E7;
            font-size: 11px;
        }
        tbody tr:hover {
            background: #F8F9FA;
        }
        .text-right {
            text-align: right;
        }
        .addon-item {
            padding-left: 20px;
            font-size: 10px;
            color: #565959;
            margin-top: 4px;
        }
        .addon-row {
            padding-left: 20px;
            font-size: 10px;
            color: #565959;
        }
        .billing-summary {
            margin-top: 30px;
            margin-left: auto;
            width: 300px;
        }
        .billing-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 11px;
        }
        .billing-row.label {
            color: #666;
        }
        .billing-row.value {
            font-weight: 500;
            color: #333;
        }
        .billing-row.subtotal {
            border-top: 1px solid #ddd;
            padding-top: 10px;
            margin-top: 5px;
            font-weight: 600;
        }
        .billing-row.total {
            border-top: 2px solid #FF9900;
            padding-top: 15px;
            margin-top: 10px;
            font-size: 16px;
            font-weight: bold;
            color: #0F1111;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 10px;
        }
        .payment-info {
            margin-top: 20px;
            padding: 15px;
            background: #f0f0f0;
            border-radius: 5px;
        }
        .payment-info p {
            margin: 5px 0;
            font-size: 11px;
        }
        @media print {
            .invoice-container {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header -->
        <div class="header">
            <div class="company-info">
                <h1>${company.name}</h1>
                <p>${company.address}</p>
                <p>Phone: ${company.phone} | Email: ${company.email}</p>
                ${company.gstin ? `<p>GSTIN: ${company.gstin}</p>` : ''}
            </div>
            <div class="invoice-info">
                <h2>INVOICE</h2>
                <p class="invoice-number">${data.invoiceNumber}</p>
                <p><strong>Date:</strong> ${data.orderDate}</p>
                <p><strong>Order ID:</strong> ${data.orderId.slice(0, 8).toUpperCase()}</p>
            </div>
        </div>

        <!-- Customer & Shipping Details -->
        <div class="details-section">
            <div class="detail-box">
                <h3>Bill To:</h3>
                <p><strong>${data.customer.name}</strong></p>
                <p>${data.customer.email}</p>
                ${data.customer.phone ? `<p>${data.customer.phone}</p>` : ''}
            </div>
            <div class="detail-box">
                <h3>Ship To:</h3>
                <p>${data.shippingAddress.street}</p>
                <p>${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zipCode}</p>
                <p>${data.shippingAddress.country}</p>
            </div>
        </div>

        <!-- Order Items -->
        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${data.items.map(item => {
                    const addonsTotal = item.addons ? item.addons.reduce((sum, addon) => sum + addon.price, 0) : 0;
                    const itemTotalWithAddons = item.total + addonsTotal;
                    return `
                    <tr>
                        <td>
                            <strong>${item.name}</strong>
                            ${item.variant ? `<br><small style="color: #565959;">Variant: ${item.variant}</small>` : ''}
                        </td>
                        <td>${item.quantity}</td>
                        <td class="text-right">₹${item.price.toFixed(2)}</td>
                        <td class="text-right">₹${itemTotalWithAddons.toFixed(2)}</td>
                    </tr>
                    ${item.addons && item.addons.length > 0 ? item.addons.map(addon => `
                        <tr class="addon-row">
                            <td style="padding-left: 30px; color: #565959;">
                                <small>• ${addon.name}</small>
                            </td>
                            <td></td>
                            <td></td>
                            <td class="text-right" style="color: #565959;">
                                <small>₹${addon.price.toFixed(2)}</small>
                            </td>
                        </tr>
                    `).join('') : ''}
                `;
                }).join('')}
            </tbody>
        </table>

        <!-- Billing Summary -->
        <div class="billing-summary">
            <div class="billing-row">
                <span class="label">Base Price Subtotal:</span>
                <span class="value">₹${data.billing.baseSubtotal.toFixed(2)}</span>
            </div>
            ${data.billing.addonsSubtotal > 0 ? `
                <div class="billing-row">
                    <span class="label">Addons Subtotal:</span>
                    <span class="value">₹${data.billing.addonsSubtotal.toFixed(2)}</span>
                </div>
            ` : ''}
            <div class="billing-row subtotal">
                <span class="label"><strong>Subtotal:</strong></span>
                <span class="value"><strong>₹${data.billing.subtotal.toFixed(2)}</strong></span>
            </div>
            ${data.billing.discount > 0 ? `
                <div class="billing-row">
                    <span class="label">Discount:</span>
                    <span class="value" style="color: #28a745;">-₹${data.billing.discount.toFixed(2)}</span>
                </div>
            ` : ''}
            ${data.billing.shipping > 0 ? `
                <div class="billing-row">
                    <span class="label">Shipping Charges:</span>
                    <span class="value">₹${data.billing.shipping.toFixed(2)}</span>
                </div>
            ` : ''}
            ${data.billing.tax && data.billing.tax > 0 ? `
                <div class="billing-row">
                    <span class="label">Tax (GST):</span>
                    <span class="value">₹${data.billing.tax.toFixed(2)}</span>
                </div>
            ` : ''}
            <div class="billing-row total">
                <span>Total Amount:</span>
                <span>₹${data.billing.total.toFixed(2)}</span>
            </div>
        </div>

        <!-- Payment Information -->
        <div class="payment-info">
            <h3 style="margin-bottom: 10px; font-size: 12px;">Payment Information</h3>
            <p><strong>Payment Method:</strong> ${data.payment.method}</p>
            <p><strong>Payment Status:</strong> ${data.payment.status}</p>
            ${data.payment.transactionId ? `<p><strong>Transaction ID:</strong> ${data.payment.transactionId}</p>` : ''}
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Thank you for your business!</p>
            <p>This is a computer-generated invoice and does not require a signature.</p>
        </div>
    </div>
</body>
</html>
    `;
}
