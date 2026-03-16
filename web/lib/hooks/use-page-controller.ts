/**
 * Page Controller Hook
 * Handles page controller rule fetching, matching, and validation
 */

import { useState, useEffect, useMemo } from 'react';
import { getCategoryPageControllerRules, type PageControllerRule } from '@/lib/api/pageController';
import { calculateTotalPages } from '@/lib/utils/file-validation';

export interface PageControllerValidationResult {
    isValid: boolean;
    currentPages: number;
    maxPages: number | null;
    errorMessage: string | null;
    matchedRule: PageControllerRule | null;
}

export interface UsePageControllerOptions {
    categorySlug: string;
    selectedSpecifications: Record<string, any>;
    files: File[];
    enabled?: boolean; // Whether to enable validation (default: true)
}

export function usePageController({
    categorySlug,
    selectedSpecifications,
    files,
    enabled = true,
}: UsePageControllerOptions) {
    const [rules, setRules] = useState<PageControllerRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPageCount, setCurrentPageCount] = useState(0);

    // Fetch rules on mount
    useEffect(() => {
        if (!enabled || !categorySlug) {
            setLoading(false);
            return;
        }

        async function fetchRules() {
            try {
                setLoading(true);
                setError(null);
                const fetchedRules = await getCategoryPageControllerRules(categorySlug);
                setRules(fetchedRules);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load page controller rules');
            } finally {
                setLoading(false);
            }
        }

        void fetchRules();
    }, [categorySlug, enabled]);

    // Calculate page count when files change
    useEffect(() => {
        if (!enabled || files.length === 0) {
            setCurrentPageCount(0);
            return;
        }

        async function calculatePages() {
            try {
                const totalPages = await calculateTotalPages(files);
                setCurrentPageCount(totalPages);
            } catch (err) {
                console.error('Failed to calculate page count:', err);
                setCurrentPageCount(0);
            }
        }

        void calculatePages();
    }, [files, enabled]);

    // Check if rules exist
    const hasRules = useMemo(() => {
        return enabled && rules.length > 0;
    }, [enabled, rules]);

    // Find matching rule based on selected specifications
    const matchedRule = useMemo(() => {
        if (!hasRules || Object.keys(selectedSpecifications).length === 0) {
            return null;
        }

        // Find rules that match selected specifications
        const matchingRules: PageControllerRule[] = [];

        for (const rule of rules) {
            // Independent rule (no spec dependency)
            if (!rule.specificationSlug && !rule.optionValue) {
                matchingRules.push(rule);
                continue;
            }

            // Rule depends on specification
            if (rule.specificationSlug && rule.optionValue) {
                const selectedValue = selectedSpecifications[rule.specificationSlug];
                if (selectedValue === rule.optionValue) {
                    matchingRules.push(rule);
                }
            }
        }

        if (matchingRules.length === 0) {
            return null;
        }

        // Return the most restrictive rule (lowest maxPages)
        return matchingRules.reduce((mostRestrictive, rule) => {
            if (!mostRestrictive) return rule;
            return rule.maxPages < mostRestrictive.maxPages ? rule : mostRestrictive;
        }, matchingRules[0]);
    }, [hasRules, rules, selectedSpecifications]);

    // Calculate max pages allowed
    const maxPages = useMemo(() => {
        if (!hasRules) {
            return null; // No rules = no limit
        }

        if (matchedRule) {
            return matchedRule.maxPages;
        }

        // No matching rule - check for independent rules
        const independentRules = rules.filter(
            (rule) => !rule.specificationSlug && !rule.optionValue
        );

        if (independentRules.length > 0) {
            // Return most restrictive independent rule
            return Math.min(...independentRules.map((rule) => rule.maxPages));
        }

        return null; // No rules match, no limit
    }, [hasRules, rules, matchedRule]);

    // Validate page count
    const validate = useMemo((): PageControllerValidationResult => {
        // If no rules exist, validation always passes
        if (!hasRules) {
            return {
                isValid: true,
                currentPages: currentPageCount,
                maxPages: null,
                errorMessage: null,
                matchedRule: null,
            };
        }

        // If no files uploaded yet, validation passes
        if (currentPageCount === 0) {
            return {
                isValid: true,
                currentPages: 0,
                maxPages,
                errorMessage: null,
                matchedRule: matchedRule || null,
            };
        }

        // If maxPages is null, no limit applies
        if (maxPages === null) {
            return {
                isValid: true,
                currentPages: currentPageCount,
                maxPages: null,
                errorMessage: null,
                matchedRule: matchedRule || null,
            };
        }

        // Validate against max pages
        if (currentPageCount > maxPages) {
            const specName = matchedRule?.specificationSlug
                ? `'${matchedRule.specificationSlug}'`
                : 'your selections';
            const optionValue = matchedRule?.optionValue || '';

            return {
                isValid: false,
                currentPages: currentPageCount,
                maxPages,
                errorMessage: `You have uploaded ${currentPageCount} page${
                    currentPageCount !== 1 ? 's' : ''
                }, but only ${maxPages} page${maxPages !== 1 ? 's' : ''} are allowed based on ${specName}${
                    optionValue ? ` selection of '${optionValue}'` : ''
                }. Please reduce the number of pages.`,
                matchedRule: matchedRule || null,
            };
        }

        return {
            isValid: true,
            currentPages: currentPageCount,
            maxPages,
            errorMessage: null,
            matchedRule: matchedRule || null,
        };
    }, [hasRules, currentPageCount, maxPages, matchedRule]);

    return {
        rules,
        loading,
        error,
        hasRules,
        currentPageCount,
        maxPages,
        matchedRule,
        validate,
    };
}
