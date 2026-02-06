import { get, post } from '../api-client';

export interface CategorySpecificationOption {
    id: string;
    label: string;
    value: string;
    displayOrder: number;
    isActive: boolean;
    metadata?: any;
}

export interface CategorySpecification {
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    type: 'SELECT' | 'MULTI_SELECT' | 'TEXT' | 'NUMBER' | 'BOOLEAN';
    isRequired: boolean;
    displayOrder: number;
    dependsOn?: any;
    options: CategorySpecificationOption[];
}

export interface CategoryPricingRule {
    id: string;
    categoryId: string;
    ruleType: 'BASE_PRICE' | 'SPECIFICATION_COMBINATION' | 'QUANTITY_TIER' | 'ADDON';
    specificationValues: Record<string, any>;
    basePrice?: number;
    priceModifier?: number;
    quantityMultiplier: boolean;
    minQuantity?: number;
    maxQuantity?: number;
    isActive: boolean;
    priority: number;
}

export interface CategoryConfiguration {
    id: string;
    categoryId: string;
    pageTitle?: string;
    pageDescription?: string;
    features?: string[];
    breadcrumbConfig?: any;
    layoutConfig?: any;
    fileUploadRequired: boolean;
    fileUploadConfig?: any;
}

export interface CategoryImage {
    id: string;
    categoryId: string;
    url: string;
    alt?: string | null;
    isPrimary: boolean;
    displayOrder: number;
    createdAt: string;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    image?: string;
    isActive: boolean;
    specifications: CategorySpecification[];
    pricingRules: CategoryPricingRule[];
    configuration?: CategoryConfiguration;
    images?: CategoryImage[];
}

export interface PriceCalculationRequest {
    specifications: Record<string, any>;
    quantity: number; // Total quantity (pageCount × copies when files uploaded)
    pageCount?: number; // Total pages from uploaded files
    copies?: number; // Number of copies
}

export interface PriceCalculationResponse {
    totalPrice: number;
    breakdown: Array<{ label: string; value: number }>;
    quantity: number;
}

export interface CategoryAddon {
    id: string;
    categoryId: string;
    ruleType: 'ADDON';
    specificationValues: Record<string, any>;
    priceModifier: number | null;
    minQuantity: number | null;
    maxQuantity: number | null;
    isActive: boolean;
    priority: number;
}

/**
 * Get category by slug with all specifications, options, pricing rules, and configuration
 */
export async function getCategoryBySlug(slug: string): Promise<Category> {
    const response = await get<Category>(`/categories/${slug}`);
    if (!response.data) {
        throw new Error('Category not found');
    }
    return response.data;
}

/**
 * Calculate price for a category based on specification selections
 */
export async function calculateCategoryPrice(
    slug: string,
    request: PriceCalculationRequest
): Promise<PriceCalculationResponse> {
    const response = await post<PriceCalculationResponse>(
        `/categories/${slug}/calculate-price`,
        request
    );
    if (!response.data) {
        throw new Error('Price calculation failed');
    }
    return response.data;
}

/**
 * Get ADDON pricing rules for a category (used for displaying page range variations)
 */
export async function getCategoryAddons(categorySlug: string): Promise<CategoryAddon[]> {
    const response = await get<CategoryAddon[]>(`/categories/${categorySlug}/addons`);
    return response.data || [];
}

/**
 * Get products matching a category and specification combination
 */
export async function getProductsBySpecifications(
    slug: string,
    specifications: Record<string, any>
): Promise<any[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('specifications', JSON.stringify(specifications));
    const response = await get<any[]>(`/categories/${slug}/products?${searchParams.toString()}`);
    return response.data || [];
}

/**
 * Get all active categories (public)
 */
export async function getAllCategories(): Promise<Category[]> {
    const response = await get<Category[]>('/categories');
    return response.data || [];
}

