import { useEffect, useMemo, useState } from 'react';
import {
    getCategoryPageControllerRules,
    getCategoryPageControllerSettings,
    type PageControllerRule,
    type PageControllerUiSettings,
} from '@/lib/api/pageController';

interface UsePageControllerArgs {
    categorySlug: string;
    selectedSpecifications: Record<string, any>;
    pageCount: number;
    enabled?: boolean;
}

export function usePageController({
    categorySlug,
    selectedSpecifications,
    pageCount,
    enabled = true,
}: UsePageControllerArgs) {
    const [rules, setRules] = useState<PageControllerRule[]>([]);
    const [uiSettings, setUiSettings] = useState<PageControllerUiSettings>({
        showBulkToggle: true,
        bulkToggleLabel: 'Do you need in bulks?',
        copiesLabel: 'Number of Quantity/Copies',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled || !categorySlug) return;

        const load = async () => {
            try {
                setLoading(true);
                const [nextRules, nextUiSettings] = await Promise.all([
                    getCategoryPageControllerRules(categorySlug),
                    getCategoryPageControllerSettings(categorySlug),
                ]);
                setRules(nextRules);
                setUiSettings(nextUiSettings);
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [categorySlug, enabled]);

    const matchedRule = useMemo(() => {
        if (rules.length === 0) return null;

        const matches = rules.filter((rule) => {
            if (!rule.specificationSlug && !rule.optionValue) return true;
            if (!rule.specificationSlug || !rule.optionValue) return false;
            return selectedSpecifications[rule.specificationSlug] === rule.optionValue;
        });

        if (matches.length === 0) return null;
        return matches.reduce((acc, rule) => (rule.maxPages < acc.maxPages ? rule : acc));
    }, [rules, selectedSpecifications]);

    const maxPages = matchedRule?.maxPages ?? null;
    const errorMessage =
        maxPages !== null && pageCount > maxPages
            ? `Uploaded pages (${pageCount}) exceed allowed limit (${maxPages}) for the current selection.`
            : null;

    return {
        loading,
        hasRules: rules.length > 0,
        maxPages,
        isValid: !errorMessage,
        errorMessage,
        matchedRule,
        uiSettings,
    };
}
