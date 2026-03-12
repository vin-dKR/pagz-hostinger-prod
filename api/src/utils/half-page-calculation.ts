/**
 * Half-Page Calculation Utilities
 * 
 * Provides reusable, optimized functions for handling half-page option logic
 * in price calculations. Ensures consistent behavior across all endpoints.
 */

/**
 * Interface for specification option metadata
 */
export interface OptionMetadata {
    isHalfPage?: boolean;
    allowedParentValues?: string[];
    [key: string]: any;
}

/**
 * Interface for category specification with options
 */
export interface CategorySpecificationWithOptions {
    slug: string;
    options: Array<{
        value: string;
        label?: string; // Option label for display
        metadata: any;
    }>;
}

/**
 * Result of half-page calculation
 */
export interface HalfPageCalculationResult {
    effectivePageCount: number;
    effectiveQuantity: number;
    hasHalfPageOption: boolean;
    halfPageOptionLabel?: string; // Display label (e.g., "Both Side Print")
    halfPageOptionValue?: string; // Option value (e.g., "both")
    originalPageCount: number;
    originalQuantity: number;
}

/**
 * Detects if any selected specification option has isHalfPage flag
 * 
 * @param specifications - Selected specification values (slug -> value mapping)
 * @param categorySpecs - All category specifications with their options
 * @returns Object containing the half-page option info if found
 */
export function detectHalfPageOption(
    specifications: Record<string, any>,
    categorySpecs: CategorySpecificationWithOptions[]
): { specSlug: string; optionValue: string; optionLabel?: string } | null {
    for (const [specSlug, selectedValue] of Object.entries(specifications)) {
        const spec = categorySpecs.find((s) => s.slug === specSlug);
        if (!spec) continue;

        const selectedOption = spec.options.find((o) => o.value === String(selectedValue));
        if (!selectedOption) continue;

        const metadata = selectedOption.metadata as OptionMetadata | null;
        if (metadata?.isHalfPage === true) {
            return {
                specSlug,
                optionValue: selectedOption.value,
                optionLabel: selectedOption.label, // Include label if available
            };
        }
    }
    return null;
}

/**
 * Calculates effective page count and quantity based on half-page option
 * 
 * Uses Math.ceil() to always round up, ensuring fair pricing.
 * 
 * @param pageCount - Original page count from uploaded files
 * @param quantity - Original quantity
 * @param copies - Number of copies
 * @param hasHalfPage - Whether a half-page option is selected
 * @returns Calculation result with effective values
 */
export function calculateEffectivePageCount(
    pageCount: number | null | undefined,
    quantity: number,
    copies: number | null | undefined,
    hasHalfPage: boolean
): HalfPageCalculationResult {
    const originalPageCount = pageCount || 0;
    const originalQuantity = quantity;
    const copiesCount = copies || 1;

    // If no half-page option or no page count, return original values
    if (!hasHalfPage || originalPageCount === 0) {
        return {
            effectivePageCount: originalPageCount,
            effectiveQuantity: originalQuantity,
            hasHalfPageOption: false,
            originalPageCount,
            originalQuantity,
        };
    }

    // Calculate effective page count (always round up)
    const effectivePageCount = Math.ceil(originalPageCount / 2);

    // Calculate effective quantity
    // If pageCount was provided, recalculate quantity based on effective pages
    // Otherwise, use the provided quantity divided by 2
    let effectiveQuantity: number;
    if (originalPageCount > 0) {
        effectiveQuantity = effectivePageCount * copiesCount;
    } else {
        // Fallback: divide quantity by 2 if no page count
        effectiveQuantity = Math.ceil(originalQuantity / 2);
    }

    return {
        effectivePageCount,
        effectiveQuantity,
        hasHalfPageOption: true,
        originalPageCount,
        originalQuantity,
    };
}

/**
 * Main function to process half-page logic for price calculations
 * 
 * @param specifications - Selected specification values
 * @param categorySpecs - All category specifications with options
 * @param pageCount - Original page count
 * @param quantity - Original quantity
 * @param copies - Number of copies
 * @returns Complete calculation result
 */
export function processHalfPageCalculation(
    specifications: Record<string, any>,
    categorySpecs: CategorySpecificationWithOptions[],
    pageCount: number | null | undefined,
    quantity: number,
    copies: number | null | undefined
): HalfPageCalculationResult {
    const halfPageInfo = detectHalfPageOption(specifications, categorySpecs);
    const hasHalfPage = halfPageInfo !== null;

    const result = calculateEffectivePageCount(
        pageCount,
        quantity,
        copies,
        hasHalfPage
    );

    // Add half-page option info if found
    if (halfPageInfo) {
        result.halfPageOptionLabel = halfPageInfo.optionLabel || halfPageInfo.optionValue;
        result.halfPageOptionValue = halfPageInfo.optionValue;
    }

    return result;
}

/**
 * Creates a price breakdown entry for half-page adjustment (informational)
 * 
 * @param result - Half-page calculation result
 * @param optionLabel - Label of the half-page option (optional, will use result.halfPageOptionLabel if not provided)
 * @returns Breakdown entry or null if no adjustment
 */
export function createHalfPageBreakdownEntry(
    result: HalfPageCalculationResult,
    optionLabel?: string
): { label: string; value: number } | null {
    if (!result.hasHalfPageOption || result.effectivePageCount === result.originalPageCount) {
        return null;
    }

    // Use provided label, or fallback to result label, or default text
    const displayLabel = optionLabel || result.halfPageOptionLabel || "Both Side Print";
    
    // Format: "Both Side Print: 3 pages → 2 pages"
    // For odd numbers, show the calculation clearly
    const isOdd = result.originalPageCount % 2 === 1;
    const calculationNote = isOdd 
        ? ` (${result.originalPageCount} ÷ 2 = ${(result.originalPageCount / 2).toFixed(1)}, rounded up to ${result.effectivePageCount})`
        : "";
    
    return {
        label: `${displayLabel}: ${result.originalPageCount} pages → ${result.effectivePageCount} pages${calculationNote}`,
        value: 0, // Informational only, doesn't affect price
    };
}
