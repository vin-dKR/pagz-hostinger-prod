/**
 * Product Sync Utility
 * 
 * Syncs published products with their source category specifications and pricing rules.
 * This ensures products stay up-to-date when category specs, options, or pricing rules change.
 */

import { prisma } from "../services/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

/**
 * Sync a single product with its source pricing rule and category specifications
 */
export async function syncProductFromPricingRule(productId: string): Promise<void> {
    // Find the product and its linked pricing rule
    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            category: {
                include: {
                    specifications: {
                        include: {
                            options: true,
                        },
                    },
                    pricingRules: {
                        where: {
                            productId: productId,
                        },
                    },
                },
            },
        },
    });

    if (!product || !product.generatedFromPricingRule) {
        throw new Error("Product is not generated from a pricing rule");
    }

    const rule = product.category.pricingRules[0];
    if (!rule) {
        throw new Error("Pricing rule not found for this product");
    }

    const category = product.category;
    const specValues = rule.specificationValues as Record<string, any>;

    // Rebuild product specifications with updated metadata
    const updatedSpecifications = category.specifications
        .filter((spec) => specValues[spec.slug])
        .map((spec, index) => {
            const value = specValues[spec.slug];
            const option = spec.options.find((opt) => opt.value === value);

            // Build metadata object with spec info, option metadata (half-page, dependencies)
            const metadata: any = {
                specSlug: spec.slug,
                specName: spec.name,
                optionValue: String(value),
                optionLabel: option?.label || String(value),
            };

            // Include option metadata if available (half-page, dependencies)
            if (option?.metadata) {
                const optionMetadata = option.metadata as any;
                if (optionMetadata.isHalfPage) {
                    metadata.isHalfPage = true;
                }
                if (optionMetadata.allowedParentValues) {
                    metadata.allowedParentValues = optionMetadata.allowedParentValues;
                }
            }

            // Include spec dependency info
            if (spec.dependsOn) {
                metadata.dependsOn = spec.dependsOn;
            }

            return {
                key: spec.name,
                value: option ? option.label : String(value),
                displayOrder: index,
                metadata: metadata as Prisma.InputJsonValue,
            };
        });

    // Update product specifications
    // Delete old specifications
    await prisma.productSpecification.deleteMany({
        where: { productId: productId },
    });

    // Create new specifications
    if (updatedSpecifications.length > 0) {
        await prisma.productSpecification.createMany({
            data: updatedSpecifications.map((spec) => ({
                productId: productId,
                key: spec.key,
                value: spec.value,
                displayOrder: spec.displayOrder,
                metadata: spec.metadata,
            })),
        });
    }

    // Update base price if pricing rule changed
    if (rule.basePrice && rule.basePrice !== product.basePrice) {
        await prisma.product.update({
            where: { id: productId },
            data: {
                basePrice: rule.basePrice,
            },
        });
    }
}

/**
 * Sync all products for a category
 */
export async function syncAllProductsForCategory(categoryId: string): Promise<{
    synced: number;
    errors: Array<{ productId: string; error: string }>;
}> {
    const products = await prisma.product.findMany({
        where: {
            categoryId: categoryId,
            generatedFromPricingRule: true,
        },
        include: {
            category: {
                include: {
                    pricingRules: {
                        where: {
                            isPublished: true,
                        },
                    },
                },
            },
        },
    });

    const errors: Array<{ productId: string; error: string }> = [];
    let synced = 0;

    for (const product of products) {
        try {
            await syncProductFromPricingRule(product.id);
            synced++;
        } catch (error) {
            errors.push({
                productId: product.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return { synced, errors };
}

/**
 * Sync a single product by pricing rule ID
 */
export async function syncProductByPricingRule(ruleId: string): Promise<void> {
    const rule = await prisma.categoryPricingRule.findUnique({
        where: { id: ruleId },
        include: {
            category: {
                include: {
                    specifications: {
                        include: {
                            options: true,
                        },
                    },
                },
            },
        },
    });

    if (!rule || !rule.productId) {
        throw new Error("Pricing rule not found or not published");
    }

    await syncProductFromPricingRule(rule.productId);
}
