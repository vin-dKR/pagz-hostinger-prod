/**
 * Products Service
 * Handles product management operations
 */

import { get, post, put, del, uploadFile } from './api-client';

export interface ProductListResponse {
    products: Product[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    image?: string | null;
    parentId?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ProductImage {
    id: string;
    productId: string;
    url: string;
    alt?: string | null;
    isPrimary: boolean;
    displayOrder: number;
}

export interface ProductSpecification {
    id: string;
    productId: string;
    key: string;
    value: string;
    displayOrder: number;
}

export interface ProductAttribute {
    id: string;
    productId: string;
    attributeType: string;
    attributeValue: string;
}

export interface ProductTag {
    id: string;
    productId: string;
    tag: string;
}

export interface ProductVariant {
    id: string;
    productId: string;
    name: string;
    sku?: string | null;
    stock: number;
    priceModifier: number;
    available: boolean;
}

export interface Product {
    id: string;
    name: string;
    slug?: string | null;
    description?: string | null;
    shortDescription?: string | null;
    basePrice: number;
    sellingPrice?: number | null;
    mrp?: number | null;
    categoryId: string;
    sku?: string | null;
    stock: number;
    minOrderQuantity: number;
    maxOrderQuantity?: number | null;
    weight?: number | null;
    dimensions?: string | null;
    isActive: boolean;
    isFeatured: boolean;
    isNewArrival: boolean;
    isBestSeller: boolean;
    rating?: number | null;
    totalReviews: number;
    totalSold: number;
    returnPolicy?: string | null;
    warranty?: string | null;
    generatedFromPricingRule?: boolean;
    createdAt: string;
    updatedAt: string;
    category: Category;
    variants: ProductVariant[];
    images: ProductImage[];
    specifications: ProductSpecification[];
    attributes: ProductAttribute[];
    tags: ProductTag[];
}

// Payload for creating/updating products from the admin UI.
// Mirrors the backend controller expectations but keeps most fields optional
// so the wizard can progressively build up the payload.
export interface CreateProductData {
    // Step 1: Basic info
    name: string;
    slug?: string;
    shortDescription?: string;
    description?: string;
    isActive?: boolean;

    // Step 2: Classification & Pricing
    categoryId: string;
    basePrice: number;
    sellingPrice?: number | null;
    mrp?: number | null;
    returnPolicy?: string;
    warranty?: string;

    // Step 3: Inventory & Logistics
    sku?: string;
    stock: number;
    minOrderQuantity: number;
    maxOrderQuantity?: number | null;
    weight?: number | null;
    dimensions?: string;

    // Step 4: Merchandising flags
    isFeatured?: boolean;
    isNewArrival?: boolean;
    isBestSeller?: boolean;

    // Step 5–7: Images, specifications, attributes, tags
    images?: Array<{
        url?: string;
        alt?: string;
        isPrimary?: boolean;
        displayOrder?: number;
    }>;
    specifications?: Array<{
        key?: string;
        value?: string;
        displayOrder?: number;
    }>;
    attributes?: Array<{
        type?: string;
        value?: string;
    }>;
    tags?: string[];

    // Step 8: Variants (optional during creation)
    variants?: Array<{
        name?: string;
        sku?: string;
        stock?: number;
        priceModifier?: number;
        available?: boolean;
    }>;
}

export interface UpdateProductData extends Partial<CreateProductData> {
    id: string;
}

export interface CreateVariantData {
    name: string;
    priceModifier: number;
    available?: boolean;
}

export interface ProductQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    isNewArrival?: boolean;
    isBestSeller?: boolean;
}

/**
 * Get paginated products with optional filters/search
 */
export async function getProducts(params: ProductQueryParams = {}): Promise<ProductListResponse> {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search) searchParams.set('search', params.search);
    if (params.category) searchParams.set('category', params.category);
    if (params.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
    if (params.isFeatured !== undefined) searchParams.set('isFeatured', String(params.isFeatured));
    if (params.isNewArrival !== undefined) searchParams.set('isNewArrival', String(params.isNewArrival));
    if (params.isBestSeller !== undefined) searchParams.set('isBestSeller', String(params.isBestSeller));

    const query = searchParams.toString();
    const endpoint = query ? `/admin/products?${query}` : '/admin/products';

    const response = await get<ProductListResponse>(endpoint);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch products');
    }

    return response.data;
}

/**
 * Get single product by ID
 */
export async function getProduct(id: string): Promise<Product> {
    const response = await get<Product>(`/admin/products/${id}`);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch product');
    }

    return response.data;
}

/**
 * Create new product
 */
export async function createProduct(data: CreateProductData): Promise<Product> {
    const response = await post<Product>('/admin/products', data);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create product');
    }

    return response.data;
}

/**
 * Update product
 */
export async function updateProduct(data: UpdateProductData): Promise<Product> {
    const { id, ...updateData } = data;
    const response = await put<Product>(`/admin/products/${id}`, updateData);

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update product');
    }

    return response.data;
}

/**
 * Delete product
 */
export async function deleteProduct(id: string): Promise<void> {
    const response = await del(`/admin/products/${id}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete product');
    }
}

/**
 * Add variant to product
 */
export async function addProductVariant(
    productId: string,
    variant: CreateVariantData
): Promise<ProductVariant> {
    const response = await post<ProductVariant>(
        `/admin/products/${productId}/variants`,
        variant
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to add variant');
    }

    return response.data;
}

/**
 * Upload product image file to S3
 */
export async function uploadProductImageApi(
    productId: string,
    file: File,
    options?: { alt?: string; isPrimary?: boolean }
): Promise<ProductImage> {
    const formData: Record<string, string> = {
        productId,
    };
    if (options?.alt) formData.alt = options.alt;
    if (options?.isPrimary !== undefined) formData.isPrimary = String(options.isPrimary);

    const response = await uploadFile<{ url: string; key: string; filename: string; size: number; mimetype: string; image: ProductImage }>(
        `/admin/upload/product-image`,
        file,
        formData
    );

    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to upload product image');
    }

    // The API returns { url, key, filename, size, mimetype, image }
    // We need to return the image object
    return response.data.image || response.data as unknown as ProductImage;
}

/**
 * Upload multiple product images to S3
 */
export async function uploadProductImagesApi(
    productId: string,
    files: File[]
): Promise<ProductImage[]> {
    const formData = new FormData();
    files.forEach((file) => {
        formData.append('files', file);
    });
    formData.append('productId', productId);

    const token = typeof window !== 'undefined' ?
        document.cookie.split(';').find(c => c.trim().startsWith('admin_token='))?.split('=')[1]?.trim() : null;

    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';
    const response = await fetch(`${API_BASE_URL}/admin/upload/product-images`, {
        method: 'POST',
        headers,
        body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload product images');
    }

    return data.data?.images || [];
}

/**
 * Delete product image
 */
export async function deleteProductImageApi(imageId: string): Promise<void> {
    const response = await del(`/admin/upload/product-image/${imageId}`);

    if (!response.success) {
        throw new Error(response.error || 'Failed to delete product image');
    }
}

