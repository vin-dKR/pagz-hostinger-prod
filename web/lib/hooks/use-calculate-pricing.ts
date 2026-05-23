/**
 * useCalculatePricing — Phase 1 of per-file addon pricing.
 *
 * Spec: `prompts/per-file-addon-pricing-architecture.md` §2 Phase 1.
 *
 * Calls the public `POST /cart/calculate-pricing` endpoint so web/admin
 * never reimplement the addon math. Debounces input by 200ms so spec /
 * addon toggling and page-count typing don't fire a request per keystroke.
 *
 * React Query handles caching + dedupe; identical inputs hit the cache.
 * Caller decides what to show while `isLoading` is true (typically a
 * small "Calculating…" hint over the existing total).
 */
import { useEffect, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
    calculatePricing,
    type CalculatePricingRequest,
    type CalculatePricingResponse,
    type CalculatePricingSource,
} from '@/lib/api/cart';

/** Debounce a value by `delayMs`. Skips the very first tick so the first
 *  request fires immediately (no perceived blank state on mount). */
function useDebounced<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const handle = window.setTimeout(() => setDebounced(value), delayMs);
        return () => window.clearTimeout(handle);
    }, [value, delayMs]);
    return debounced;
}

export const calculatePricingQueryKeys = {
    all: ['calculate-pricing'] as const,
    /** Build a stable key from the request. JSON stringify is fine for the
     *  shapes the endpoint accepts (no Dates, no functions). */
    detail: (input: CalculatePricingRequest) =>
        [
            ...calculatePricingQueryKeys.all,
            input.categoryId,
            JSON.stringify(input.selectedSpecifications ?? {}),
            JSON.stringify((input.selectedAddons ?? []).slice().sort()),
            JSON.stringify(input.files ?? []),
            input.copies,
            input.side ?? null,
        ] as const,
};

export interface UseCalculatePricingOptions {
    /** When false the query is parked (returns `data: undefined`). Use this
     *  to skip the round-trip until the user has picked the minimum required
     *  inputs (categoryId + required specs). */
    enabled?: boolean;
    /** Override the 200ms input debounce. */
    debounceMs?: number;
    /** Tag the call site so prod logs can correlate two pricing requests
     *  coming from different surfaces (services page vs guest cart). */
    source?: CalculatePricingSource;
}

export type UseCalculatePricingResult = UseQueryResult<
    CalculatePricingResponse | undefined
>;

/**
 * Live, debounced pricing for the services page + cart/checkout previews.
 *
 * Returns the standard react-query result. `data` is the response body or
 * `undefined` while the first request is in flight.
 */
export function useCalculatePricing(
    input: CalculatePricingRequest,
    options: UseCalculatePricingOptions = {},
): UseCalculatePricingResult {
    const { enabled = true, debounceMs = 200, source = 'unknown' } = options;
    const debounced = useDebounced(input, debounceMs);

    return useQuery<CalculatePricingResponse | undefined>({
        queryKey: calculatePricingQueryKeys.detail(debounced),
        // Only fire when the caller hands us a categoryId. Guards against
        // initial-render passes before the category fetch completes.
        enabled: enabled && Boolean(debounced.categoryId),
        // Pricing rules change rarely; 30s lets a fast tab-switch reuse
        // the previous response. The 200ms debounce is the gate that
        // matters for the typing-then-pick UX.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        queryFn: async () => {
            const res = await calculatePricing(debounced, source);
            if (!res.success || !res.data) {
                throw new Error(res.error || 'Pricing request failed');
            }
            return res.data;
        },
    });
}
