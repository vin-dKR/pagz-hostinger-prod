/**
 * Specification Dependency Utilities for Web Frontend
 * 
 * Optimized, reusable functions for handling specification dependencies
 * in the web frontend. Provides efficient filtering and visibility checks.
 */

import type { CategorySpecification, CategorySpecificationOption, SpecificationDependency } from '../api/categories';

/**
 * Filters options based on parent specification value
 * Returns options that are available for the given parent value
 */
export function filterOptionsByParentValue(
    options: CategorySpecificationOption[],
    parentValue: string | null | undefined
): CategorySpecificationOption[] {
    if (!parentValue) {
        // If no parent value, return all options
        return options;
    }

    return options.filter((option) => {
        const metadata = option.metadata as { allowedParentValues?: string[] } | null;
        const allowedValues = metadata?.allowedParentValues;

        // If no restrictions, show for all parent values
        if (!allowedValues || allowedValues.length === 0) {
            return true;
        }

        // Show only if parent value is in allowed list
        return allowedValues.includes(parentValue);
    });
}

/**
 * Gets all dependent specifications that should be cleared when parent changes
 */
export function getDependentSpecifications(
    allSpecs: CategorySpecification[],
    parentSlug: string
): string[] {
    return allSpecs
        .filter((spec) => {
            const dependsOn = spec.dependsOn as SpecificationDependency | null;
            return dependsOn?.specificationSlug === parentSlug;
        })
        .map((spec) => spec.slug);
}

/**
 * Checks if a specification should be visible based on dependencies
 */
export function isSpecificationVisible(
    spec: CategorySpecification,
    selectedSpecifications: Record<string, any>
): boolean {
    const dependsOn = spec.dependsOn as SpecificationDependency | null;
    
    if (!dependsOn) {
        return true;
    }

    const parentValue = selectedSpecifications[dependsOn.specificationSlug];
    
    // If dependency is required and parent not selected, hide
    if (dependsOn.required && !parentValue) {
        return false;
    }

    // If dependency is optional, always show (but options may be filtered)
    return true;
}

/**
 * Gets available options for a specification based on dependencies
 * This is the main function used by the frontend to filter options
 */
export function getAvailableOptions(
    spec: CategorySpecification,
    selectedSpecifications: Record<string, any>
): CategorySpecificationOption[] {
    // If spec has no dependency, return all options
    if (!spec.dependsOn) {
        return spec.options;
    }

    const dependsOn = spec.dependsOn as SpecificationDependency;
    
    // Get parent spec value
    const parentValue = selectedSpecifications[dependsOn.specificationSlug];
    
    // If parent not selected and dependency is required, return empty
    if (!parentValue && dependsOn.required) {
        return [];
    }
    
    // Filter options based on allowedParentValues
    return filterOptionsByParentValue(spec.options, parentValue);
}

/**
 * Clears dependent specifications when parent changes
 * Returns updated specifications object
 */
export function clearDependentSpecifications(
    allSpecs: CategorySpecification[],
    selectedSpecifications: Record<string, any>,
    changedParentSlug: string
): Record<string, any> {
    const updated = { ...selectedSpecifications };
    
    // Find all specs that depend on the changed parent
    const dependentSpecs = getDependentSpecifications(allSpecs, changedParentSlug);
    
    // Clear their values
    dependentSpecs.forEach((depSlug) => {
        delete updated[depSlug];
    });
    
    return updated;
}
