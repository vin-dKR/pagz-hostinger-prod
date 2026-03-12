/**
 * Specification Dependency Utilities
 * 
 * Provides reusable, optimized functions for managing specification dependencies.
 * Handles validation, circular dependency detection, and dependency resolution.
 */

import { ValidationError } from "./errors.js";

/**
 * Type definition for dependency structure
 */
export interface SpecificationDependency {
    specificationSlug: string;
    required: boolean;
}

/**
 * Validates a dependency object structure
 */
export function validateDependencyStructure(
    dependsOn: any
): dependsOn is SpecificationDependency | null {
    if (dependsOn === null || dependsOn === undefined) {
        return true;
    }

    if (typeof dependsOn !== "object") {
        return false;
    }

    if (
        typeof dependsOn.specificationSlug !== "string" ||
        dependsOn.specificationSlug.trim() === ""
    ) {
        return false;
    }

    if (typeof dependsOn.required !== "boolean") {
        return false;
    }

    return true;
}

/**
 * Validates that a dependency references a valid specification
 * and prevents circular dependencies
 */
export async function validateDependency(
    categoryId: string,
    specSlug: string,
    dependsOn: SpecificationDependency | null,
    allSpecs: Array<{ id: string; slug: string; displayOrder: number; dependsOn: any }>,
    excludeSpecId?: string
): Promise<void> {
    if (!dependsOn) {
        return;
    }

    // Find the parent specification
    const parentSpec = allSpecs.find(
        (s) => s.slug === dependsOn.specificationSlug && (excludeSpecId ? s.id !== excludeSpecId : true)
    );

    if (!parentSpec) {
        throw new ValidationError(
            `Dependency references a non-existent specification: ${dependsOn.specificationSlug}`
        );
    }

    // Prevent self-dependency
    if (parentSpec.slug === specSlug) {
        throw new ValidationError("A specification cannot depend on itself");
    }

    // Check for circular dependencies (only one level deep for now)
    const parentDependsOn = parentSpec.dependsOn as SpecificationDependency | null;
    if (parentDependsOn) {
        if (parentDependsOn.specificationSlug === specSlug) {
            throw new ValidationError(
                "Circular dependency detected: this would create a dependency cycle"
            );
        }
    }

    // Validate that parent comes before this spec in display order
    // (This ensures dependencies flow in the correct direction)
    const currentSpec = allSpecs.find((s) => s.slug === specSlug && (excludeSpecId ? s.id !== excludeSpecId : true));
    if (currentSpec && parentSpec.displayOrder >= currentSpec.displayOrder) {
        throw new ValidationError(
            `Dependent specification must come after its parent in display order. ` +
            `Parent "${parentSpec.slug}" has order ${parentSpec.displayOrder}, ` +
            `current spec has order ${currentSpec.displayOrder}`
        );
    }
}

/**
 * Filters options based on parent specification value
 * Returns options that are available for the given parent value
 */
export function filterOptionsByParentValue(
    options: Array<{ value: string; metadata: any }>,
    parentValue: string | null | undefined
): Array<{ value: string; metadata: any }> {
    if (!parentValue) {
        // If no parent value, return all options (or empty if required)
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
    allSpecs: Array<{ slug: string; dependsOn: any }>,
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
    spec: { dependsOn: any },
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
