/**
 * Products API functions
 */

import { get, ApiResponse } from '../api-client';

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    image?: string;
    parentId?: string;
    isActive: boolean;
}

export interface ProductImage {
    id: string;
    url: string;
    alt?: string;
    isPrimary: boolean;
    displayOrder: number;
}

export interface ProductVariant {
    id: string;
    name: string;
    sku?: string;
    stock: number;
    priceModifier: number;
    available: boolean;
}

export interface Product {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    shortDescription?: string;
    basePrice: number;
    sellingPrice?: number;
    mrp?: number;
    categoryId: string;
    sku?: string;
    stock: number;
    minOrderQuantity: number;
    maxOrderQuantity?: number;
    weight?: number;
    dimensions?: string;
    isActive: boolean;
    isFeatured: boolean;
    isNewArrival: boolean;
    isBestSeller: boolean;
    rating?: number;
    reviews: Review[];
    totalReviews: number;
    totalSold: number;
    returnPolicy?: string;
    warranty?: string;
    createdAt: string;
    updatedAt: string;
    category?: Category;
    images?: ProductImage[];
    variants?: ProductVariant[];
    specifications: ProductSpecification[];
    attributes?: ProductAttribute[];
    tags?: ProductTag[];
}

export interface Review {
    id: string
    productId: string
    userId: string
    rating: number
    title: string
    comment: string
    images: string[]
    isVerifiedPurchase: boolean
    isHelpful: number
    isApproved: boolean
}
export interface ProductSpecification {
    id: string
    productId: string
    key: string
    value: string
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

export interface ProductListParams {
    page?: number;
    limit?: number;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: 'price' | 'rating' | 'createdAt' | 'totalSold';
    sortOrder?: 'asc' | 'desc';
    search?: string;
    isFeatured?: boolean;
    isNewArrival?: boolean;
    isBestSeller?: boolean;
}

export interface ProductListResponse {
    products: Product[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<ApiResponse<Category[]>> {
    return get<Category[]>('/categories');
}

/**
 * Get products with filters and pagination
 */
export async function getProducts(
    params?: ProductListParams
): Promise<ApiResponse<ProductListResponse>> {
    const queryParams = new URLSearchParams();

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, String(value));
            }
        });
    }

    const queryString = queryParams.toString();
    return get<ProductListResponse>(`/products${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get single product by ID
 */
export async function getProduct(id: string): Promise<ApiResponse<Product>> {
    return get<Product>(`/products/${id}`);
}

/**
 * Search products
 */
export async function searchProducts(
    query: string,
    params?: Omit<ProductListParams, 'search'>
): Promise<ApiResponse<ProductListResponse>> {
    const queryParams = new URLSearchParams({ search: query });

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, String(value));
            }
        });
    }

    return get<ProductListResponse>(`/search?${queryParams.toString()}`);
}

