import { get, post } from '../api-client';

export interface SpecificationDependency {
    specificationSlug: string;
    required: boolean;
}

export interface OptionMetadata {
    allowedParentValues?: string[];
    isHalfPage?: boolean;
    [key: string]: any;
}

export interface CategorySpecificationOption {
    id: string;
    label: string;
    value: string;
    displayOrder: number;
    isActive: boolean;
    metadata?: OptionMetadata;
}

export interface CategorySpecification {
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    type: 'SELECT' | 'MULTI_SELECT' | 'TEXT' | 'NUMBER' | 'BOOLEAN';
    isRequired: boolean;
    displayOrder: number;
    dependsOn?: SpecificationDependency | null;
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
    isPublished?: boolean;
    productId?: string | null;
}

export interface CategoryConfiguration {
    id: string;
    categoryId: string;
    pageTitle?: string;
    pageDescription?: string;
    features?: string[];
    breadcrumbConfig?: any;
    layoutConfig?: {
        comingSoon?: boolean;
        [key: string]: any;
    } | null;
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
    parentId?: string | null;
    isActive: boolean;
    priority: number;
    /** Minimum order subtotal required for items in this category, in
     *  rupees. Null or 0 means no minimum. Server enforces it via
     *  /cart/validate-minimums and createOrder; the client mirrors the
     *  check to surface a clear error at add-to-cart time so guests
     *  don't discover the rule only after logging in. */
    minCartValue?: number | string | null;
    specifications: CategorySpecification[];
    pricingRules: CategoryPricingRule[];
    configuration?: CategoryConfiguration;
    images?: CategoryImage[];
    // Parent-child hierarchy fields
    parent?: {
        id: string;
        name: string;
        slug: string;
    } | null;
    children?: Category[];
    childrenCount?: number;
    hasChildren?: boolean;
}

export interface PriceCalculationRequest {
    specifications: Record<string, any>;
    quantity: number; // Total quantity (pageCount × copies when files uploaded)
    pageCount?: number; // Total pages from uploaded files
    copies?: number; // Number of copies
    fileCount?: number; // Number of uploaded files, used by fileMultiplier addon rules
}

export interface PriceCalculationResponse {
    totalPrice: number;
    breakdown: Array<{ label: string; value: number }>;
    quantity: number;
    originalQuantity?: number;
    effectivePageCount?: number;
    originalPageCount?: number;
    hasHalfPageAdjustment?: boolean;
    baseQuantityMultiplierApplied?: boolean;
}

export interface CategoryAddon {
    id: string;
    categoryId: string;
    ruleType: 'ADDON';
    specificationValues: Record<string, any>;
    priceModifier: number | null;
    quantityMultiplier?: boolean;
    fileMultiplier?: boolean;
    /** One charge per physical copy. Range checks per-copy pages. */
    copyMultiplier?: boolean;
    /** Evaluate the addon separately for each uploaded file, then sum.
     *  When true, range checks run per file against each file's own page count. */
    perFileEvaluation?: boolean;
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

