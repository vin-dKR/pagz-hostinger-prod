/**
 * Invoice Service - PDF download and print functionality
 */

import { getAuthToken } from '../api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Download invoice as PDF
 */
export async function downloadInvoicePDF(orderId: string): Promise<void> {
    const token = getAuthToken();
    const endpoint = `/customer/orders/${orderId}/invoice/pdf`;
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to download invoice');
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `Invoice-${orderId}.pdf`
        : `Invoice-${orderId}.pdf`;

    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

/**
 * Print invoice (opens PDF in new window for printing)
 */
export async function printInvoice(orderId: string): Promise<void> {
    const token = getAuthToken();
    const endpoint = `/customer/orders/${orderId}/invoice/pdf`;
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to load invoice');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (printWindow) {
        printWindow.onload = () => {
            printWindow.print();
        };
    }
}
