/**
 * Category Ordering Utilities
 * 
 * Provides reusable, optimized functions for ordering categories by priority.
 * Ensures consistent ordering logic across all endpoints.
 */

import { Prisma } from "../../generated/prisma/client.js";

/**
 * Default ordering for categories: priority ASC, then name ASC
 * Lower priority values appear first, with name as secondary sort
 */
export const DEFAULT_CATEGORY_ORDER_BY: Prisma.CategoryOrderByWithRelationInput[] = [
    { priority: "asc" },
    { name: "asc" },
];

/**
 * Admin panel ordering: priority ASC, then createdAt DESC
 * Useful for admin views where recent items are also important
 */
export const ADMIN_CATEGORY_ORDER_BY: Prisma.CategoryOrderByWithRelationInput[] = [
    { priority: "asc" },
    { createdAt: "desc" },
];

/**
 * Validates priority value
 * @param priority - Priority value to validate
 * @returns Validated priority (defaults to 0 if invalid)
 */
export function validatePriority(priority: any): number {
    if (typeof priority === "number" && !isNaN(priority)) {
        return Math.round(priority);
    }
    if (typeof priority === "string") {
        const parsed = parseInt(priority, 10);
        if (!isNaN(parsed)) {
            return parsed;
        }
    }
    return 0;
}

/**
 * Normalizes priority for database storage
 * Ensures priority is always an integer
 */
export function normalizePriority(priority: any): number {
    return validatePriority(priority);
}
