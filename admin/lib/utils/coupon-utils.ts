/**
 * Coupon utility functions
 * Handles coupon code generation, validation, and formatting
 */

/**
 * Generate a random coupon code
 * Format: [PREFIX]-[RANDOM]
 * Example: SAVE-ABC123, FLAT50-XYZ789
 */
export function generateCouponCode(
    prefix: string = 'SAVE',
    length: number = 6
): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';

    for (let i = 0; i < length; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `${prefix.toUpperCase()}-${randomPart}`;
}

/**
 * Validate coupon code format
 */
export function isValidCouponCode(code: string): boolean {
    return /^[A-Z0-9-]{3,20}$/.test(code);
}

/**
 * Format discount display
 */
export function formatDiscount(
    type: 'PERCENTAGE' | 'FIXED',
    value: number
): string {
    if (type === 'PERCENTAGE') {
        return `${value}% OFF`;
    }
    return `₹${value} OFF`;
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(
    type: 'PERCENTAGE' | 'FIXED',
    value: number,
    orderAmount: number,
    maxDiscount?: number
): number {
    let discount = 0;

    if (type === 'PERCENTAGE') {
        discount = (orderAmount * value) / 100;
    } else {
        discount = value;
    }

    if (maxDiscount && discount > maxDiscount) {
        discount = maxDiscount;
    }

    return Math.min(discount, orderAmount);
}

