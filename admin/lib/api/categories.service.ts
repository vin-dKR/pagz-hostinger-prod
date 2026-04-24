/**
 * Categories Service
 * Handles category management operations (including specifications & pricing)
 */

import { get, post, put, del } from './api-client';
import { uploadFileToFTP, FTP_FOLDERS } from './ftp';

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
    parentId?: string;
    parent?: {
        id: string;
        name: string;
        slug: string;
    } | null;
    images?: CategoryImage[];
    primaryImage?: CategoryImage | null;
    priority: number;
    isActive: boolean;
    /**
     * Optional minimum cart subtotal (in ₹) required for the order to go
     * through when the cart contains items from this category. Null / 0 /
     * undefined disables the check.
     */
    minCartValue?: number | string | null;
    _count?: {
        products: number;
        specifications: number;
        pricingRules: number;
        images: number;
        publishedPricingRules?: number;
    };
    createdAt: string;
    updatedAt: string;
}

export interface CreateCategoryData {
    name: string;
    description?: string;
    parentId?: string;
    priority?: number;
    minCartValue?: number | null;
}

export interface UpdateCategoryData {
    name?: string;
    description?: string;
    parentId?: string | null;
    priority?: number;
    minCartValue?: number | null;
}

export interface CategorySearchResult {
    id: string;
    name: string;
    slug: string;
    parentId?: string | null;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedCategories {
    items: Category[];
    pagination: PaginationMeta;
}

export interface CategoryQueryParams {
    page?: number;
    limit?: number;
    search?: string;
}

// Specification & pricing types (mirror backend)

export type SpecificationType = 'SELECT' | 'MULTI_SELECT' | 'TEXT' | 'NUMBER' | 'BOOLEAN';

export interface OptionMetadata {
    allowedParentValues?: string[];
    isHalfPage?: boolean;
    [key: string]: any;
}

export interface CategorySpecificationOption {
    id: string;
    specificationId: string;
    label: string;
    value: string;
    displayOrder: number;
    isActive: boolean;
    metadata?: OptionMetadata;
}

export interface SpecificationDependency {
    specificationSlug: string;
    required: boolean;
}

export interface CategorySpecification {
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    type: SpecificationType;
    isRequired: boolean;
    displayOrder: number;
    dependsOn?: SpecificationDependency | null;
    options: CategorySpecificationOption[];
}

export type PricingRuleType = 'BASE_PRICE' | 'SPECIFICATION_COMBINATION' | 'QUANTITY_TIER' | 'ADDON';

export interface CategoryPricingRule {
    id: string;
    categoryId: string;
    ruleType: PricingRuleType;
    specificationValues: Record<string, any>;
    basePrice?: number | null;
    priceModifier?: number | null;
    quantityMultiplier: boolean;
    fileMultiplier?: boolean;
    minQuantity?: number | null;
    maxQuantity?: number | null;
    isActive: boolean;
    priority: number;
    productId?: string | null;
    isPublished: boolean;
}

export interface CategoryConfiguration {
    id: string;
    categoryId: string;
    pageTitle?: string;
    pageDescription?: string;
    features?: string[] | null;
    breadcrumbConfig?: any;
    layoutConfig?: {
        comingSoon?: boolean;
        [key: string]: any;
    } | null;
    fileUploadRequired: boolean;
    fileUploadConfig?: any;
}

export interface UpsertCategoryConfigurationData {
    pageTitle?: string;
    pageDescription?: string;
    features?: string[] | null;
    breadcrumbConfig?: any;
    layoutConfig?: {
        comingSoon?: boolean;
        [key: string]: any;
    } | null;
    fileUploadRequired?: boolean;
    fileUploadConfig?: any;
}

/**
 * Get paginated categories (admin) with optional search
 */
export async function getCategories(
    params: CategoryQueryParams = {}
): Promise<PaginatedCategories> {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search) searchParams.set('search', params.search);

    const query = searchParams.toString();
    const endpoint = query ? `/admin/categories?${query}` : '/admin/categories';

    const response = await get<{
        categories: Category[];
        pagination: PaginationMeta;
    }>(endpoint);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch categories');
    }

    return {
        items: response.data.categories,
        pagination: response.data.pagination,
    };
}

/**
 * Create new category
 */
export async function createCategory(data: CreateCategoryData): Promise<Category> {
    const response = await post<Category>('/admin/categories', data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create category');
    }

    return response.data;
}

/**
 * Get single category by id (admin)
 * Currently uses the paginated list and filters client-side.
 */
export async function getCategoryById(id: string): Promise<Category> {
    const { items } = await getCategories({ page: 1, limit: 200 });
    const found = items.find((c) => c.id === id);
    if (!found) {
        throw new Error('Category not found');
    }
    return found;
}

/**
 * Update category basic fields
 */
export async function updateCategory(id: string, data: UpdateCategoryData): Promise<Category> {
    const response = await put<Category>(`/admin/categories/${id}`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update category');
    }

    return response.data;
}

export async function deleteCategory(id: string): Promise<{ deletedProductsCount: number }> {
    const response = await del<{ deletedProductsCount: number }>(`/admin/categories/${id}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete category');
    }

    return response.data || { deletedProductsCount: 0 };
}

/**
 * Search categories by name (for parent category selector)
 */
export async function searchCategories(
    query: string,
    excludeId?: string,
    limit: number = 10
): Promise<CategorySearchResult[]> {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const params = new URLSearchParams({
        q: query.trim(),
        limit: limit.toString(),
    });

    if (excludeId) {
        params.set('excludeId', excludeId);
    }

    const response = await get<CategorySearchResult[]>(`/admin/categories/search?${params.toString()}`);

    if (!response.success || !response.data) {
        return [];
    }

    return response.data;
}

// Specifications

export interface CreateSpecificationData {
    name: string;
    type: SpecificationType;
    isRequired?: boolean;
    displayOrder?: number;
    dependsOn?: SpecificationDependency | null;
}

export interface UpdateSpecificationData extends Partial<CreateSpecificationData> { }

export async function getCategorySpecificationsApi(
    categoryId: string
): Promise<CategorySpecification[]> {
    const response = await get<CategorySpecification[]>(`/admin/categories/${categoryId}/specifications`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch specifications');
    }

    return response.data;
}

export async function createCategorySpecificationApi(
    categoryId: string,
    data: CreateSpecificationData
): Promise<CategorySpecification> {
    const response = await post<CategorySpecification>(
        `/admin/categories/${categoryId}/specifications`,
        data
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create specification');
    }

    return response.data;
}

export async function updateCategorySpecificationApi(
    categoryId: string,
    specId: string,
    data: UpdateSpecificationData
): Promise<CategorySpecification> {
    const response = await put<CategorySpecification>(
        `/admin/categories/${categoryId}/specifications/${specId}`,
        data
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update specification');
    }

    return response.data;
}

export async function deleteCategorySpecificationApi(
    categoryId: string,
    specId: string
): Promise<void> {
    const response = await del<null>(`/admin/categories/${categoryId}/specifications/${specId}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete specification');
    }
}

// Specification options

export interface CreateSpecificationOptionData {
    label: string;
    displayOrder?: number;
    isActive?: boolean;
    metadata?: OptionMetadata;
}

export interface UpdateSpecificationOptionData extends Partial<CreateSpecificationOptionData> { }

export async function getSpecificationOptionsApi(
    categoryId: string,
    specId: string
): Promise<CategorySpecificationOption[]> {
    const response = await get<CategorySpecificationOption[]>(
        `/admin/categories/${categoryId}/specifications/${specId}/options`
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch specification options');
    }

    return response.data;
}

export async function createSpecificationOptionApi(
    categoryId: string,
    specId: string,
    data: CreateSpecificationOptionData
): Promise<CategorySpecificationOption> {
    const response = await post<CategorySpecificationOption>(
        `/admin/categories/${categoryId}/specifications/${specId}/options`,
        data
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create specification option');
    }

    return response.data;
}

export async function updateSpecificationOptionApi(
    categoryId: string,
    specId: string,
    optionId: string,
    data: UpdateSpecificationOptionData
): Promise<CategorySpecificationOption> {
    const response = await put<CategorySpecificationOption>(
        `/admin/categories/${categoryId}/specifications/${specId}/options/${optionId}`,
        data
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update specification option');
    }

    return response.data;
}

export async function deleteSpecificationOptionApi(
    categoryId: string,
    specId: string,
    optionId: string
): Promise<void> {
    const response = await del<null>(
        `/admin/categories/${categoryId}/specifications/${specId}/options/${optionId}`
    );

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete specification option');
    }
}

// Pricing rules

export interface CreatePricingRuleData {
    ruleType: PricingRuleType;
    specificationValues: Record<string, any>;
    basePrice?: number | null;
    priceModifier?: number | null;
    quantityMultiplier?: boolean;
    fileMultiplier?: boolean;
    minQuantity?: number | null;
    maxQuantity?: number | null;
    isActive?: boolean;
    priority?: number;
}

export interface UpdatePricingRuleData extends Partial<CreatePricingRuleData> { }

export async function getCategoryPricingRulesApi(
    categoryId: string
): Promise<CategoryPricingRule[]> {
    const response = await get<CategoryPricingRule[]>(`/admin/categories/${categoryId}/pricing`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch pricing rules');
    }

    return response.data;
}

export async function createCategoryPricingRuleApi(
    categoryId: string,
    data: CreatePricingRuleData
): Promise<CategoryPricingRule> {
    const response = await post<CategoryPricingRule>(
        `/admin/categories/${categoryId}/pricing`,
        data
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create pricing rule');
    }

    return response.data;
}

export async function updateCategoryPricingRuleApi(
    categoryId: string,
    ruleId: string,
    data: UpdatePricingRuleData
): Promise<CategoryPricingRule> {
    const response = await put<CategoryPricingRule>(
        `/admin/categories/${categoryId}/pricing/${ruleId}`,
        data
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update pricing rule');
    }

    return response.data;
}

export async function deleteCategoryPricingRuleApi(
    categoryId: string,
    ruleId: string
): Promise<void> {
    const response = await del<null>(`/admin/categories/${categoryId}/pricing/${ruleId}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete pricing rule');
    }
}

// Category configuration

export async function getCategoryConfigurationApi(
    categoryId: string
): Promise<CategoryConfiguration | null> {
    const response = await get<CategoryConfiguration | null>(
        `/admin/categories/${categoryId}/configuration`
    );

    if (!response.success) {
        throw new Error(response.error || 'Failed to fetch category configuration');
    }

    return response.data ?? null;
}

export async function upsertCategoryConfigurationApi(
    categoryId: string,
    data: UpsertCategoryConfigurationData
): Promise<CategoryConfiguration> {
    const response = await put<CategoryConfiguration>(
        `/admin/categories/${categoryId}/configuration`,
        data
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to save category configuration');
    }

    return response.data;
}

// Category Images

export interface CreateCategoryImageData {
    url: string;
    alt?: string;
    isPrimary?: boolean;
    displayOrder?: number;
}

export interface UpdateCategoryImageData {
    url?: string;
    alt?: string;
    isPrimary?: boolean;
    displayOrder?: number;
}

export async function getCategoryImagesApi(categoryId: string): Promise<CategoryImage[]> {
    const response = await get<CategoryImage[]>(`/admin/categories/${categoryId}/images`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch category images');
    }

    return response.data;
}

export async function createCategoryImageApi(
    categoryId: string,
    data: CreateCategoryImageData
): Promise<CategoryImage> {
    const response = await post<CategoryImage>(`/admin/categories/${categoryId}/images`, data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create category image');
    }

    return response.data;
}

/**
 * Upload a category image via FTP, then register it in the DB.
 *
 * Files go to the `categories/` folder on the FTP server.
 * Only the relative path is stored in the DB.
 */
export async function uploadCategoryImageApi(
    categoryId: string,
    file: File,
    options?: { alt?: string; isPrimary?: boolean },
): Promise<CategoryImage> {
    // 1. Upload file to FTP → get relative path
    const ftpResult = await uploadFileToFTP(file, FTP_FOLDERS.CATEGORIES);

    // 2. Register in DB via the existing category-images endpoint
    return createCategoryImageApi(categoryId, {
        url:       ftpResult.path,
        alt:       options?.alt,
        isPrimary: options?.isPrimary,
    });
}

export async function updateCategoryImageApi(
    categoryId: string,
    imageId: string,
    data: UpdateCategoryImageData
): Promise<CategoryImage> {
    const response = await put<CategoryImage>(
        `/admin/categories/${categoryId}/images/${imageId}`,
        data
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update category image');
    }

    return response.data;
}

export async function deleteCategoryImageApi(categoryId: string, imageId: string): Promise<void> {
    const response = await del<null>(`/admin/categories/${categoryId}/images/${imageId}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete category image');
    }
}

// Publish Pricing Rule as Product

export interface PreviewProductData {
    name: string;
    slug: string;
    description: string;
    shortDescription: string;
    basePrice: number;
    categoryId: string;
    categoryName: string;
    specifications: Array<{ key: string; value: string; displayOrder: number }>;
    specificationValues: Record<string, any>;
    pricingRuleId: string;
}

export interface PublishProductData {
    name?: string;
    slug?: string;
    description?: string;
    shortDescription?: string;
    stock?: number;
    sku?: string;
    minOrderQuantity?: number;
    maxOrderQuantity?: number;
    images?: Array<{ url: string; alt?: string; isPrimary?: boolean; displayOrder?: number }>;
    addonIds?: string[];
}

export async function previewProductFromPricingRuleApi(
    categoryId: string,
    ruleId: string
): Promise<PreviewProductData> {
    const response = await get<PreviewProductData>(
        `/admin/categories/${categoryId}/pricing-rules/${ruleId}/preview-product`
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to preview product');
    }

    return response.data;
}

export async function syncProductFromCategoryApi(
    categoryId: string,
    ruleId?: string
): Promise<{ synced: number; errors: Array<{ productId: string; error: string }> } | null> {
    const url = ruleId
        ? `/admin/categories/${categoryId}/pricing-rules/${ruleId}/sync-product`
        : `/admin/categories/${categoryId}/sync-products`;
    
    const response = await post<{ synced: number; errors: Array<{ productId: string; error: string }> } | null>(url, {});

    if (!response.success) {
        throw new Error(response.error || 'Failed to sync products');
    }

    // For single product sync, data can be null (successful but no data returned)
    // For bulk sync, data contains synced count and errors
    return response.data ?? null;
}

export async function publishPricingRuleAsProductApi(
    categoryId: string,
    ruleId: string,
    data: PublishProductData
): Promise<any> {
    const response = await post<any>(
        `/admin/categories/${categoryId}/pricing-rules/${ruleId}/publish`,
        data
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to publish product');
    }

    return response.data;
}

export async function updateProductFromPricingRuleApi(
    categoryId: string,
    ruleId: string,
    data: PublishProductData
): Promise<any> {
    const response = await put<any>(
        `/admin/categories/${categoryId}/pricing-rules/${ruleId}/update-product`,
        data
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update product');
    }

    return response.data;
}
 