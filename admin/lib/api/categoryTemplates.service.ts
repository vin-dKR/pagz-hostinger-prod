/**
 * Category Templates Service
 * Handles template and form management operations
 */

import { get, post, put, del } from './api-client';

export interface FormField {
    id?: string;
    type: 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'file';
    label: string;
    placeholder?: string;
    isRequired?: boolean;
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        minLength?: number;
        maxLength?: number;
    };
    displayOrder?: number;
    options?: Array<{ label: string; value: string }>; // For select type
}

export interface CategoryTemplateForm {
    id: string;
    templateId: string;
    fields: FormField[];
    requiresImageUpload: boolean;
    imageUploadRequired: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CategoryTemplate {
    id: string;
    categoryId: string;
    name: string;
    description?: string | null;
    previewImageUrl?: string | null;
    displayOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    form?: CategoryTemplateForm | null;
}

export interface CreateTemplateData {
    name: string;
    description?: string;
    previewImageUrl?: string;
    displayOrder?: number;
    isActive?: boolean;
}

export interface UpdateTemplateData {
    name?: string;
    description?: string;
    previewImageUrl?: string;
    displayOrder?: number;
    isActive?: boolean;
}

export interface UpsertFormData {
    fields: FormField[];
    requiresImageUpload?: boolean;
    imageUploadRequired?: boolean;
}

/**
 * Get all templates for a category
 */
export async function getCategoryTemplates(categoryId: string): Promise<CategoryTemplate[]> {
    const response = await get<CategoryTemplate[]>(
        `/admin/categories/${categoryId}/templates`
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch templates');
    }
    return response.data;
}

/**
 * Get a single template by ID
 */
export async function getCategoryTemplate(
    categoryId: string,
    templateId: string
): Promise<CategoryTemplate> {
    const response = await get<CategoryTemplate>(
        `/admin/categories/${categoryId}/templates/${templateId}`
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch template');
    }
    return response.data;
}

/**
 * Create a new template
 */
export async function createCategoryTemplate(
    categoryId: string,
    data: CreateTemplateData
): Promise<CategoryTemplate> {
    const response = await post<CategoryTemplate>(
        `/admin/categories/${categoryId}/templates`,
        data
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create template');
    }
    return response.data;
}

/**
 * Update a template
 */
export async function updateCategoryTemplate(
    categoryId: string,
    templateId: string,
    data: UpdateTemplateData
): Promise<CategoryTemplate> {
    const response = await put<CategoryTemplate>(
        `/admin/categories/${categoryId}/templates/${templateId}`,
        data
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update template');
    }
    return response.data;
}

/**
 * Delete a template
 */
export async function deleteCategoryTemplate(
    categoryId: string,
    templateId: string
): Promise<void> {
    await del(`/admin/categories/${categoryId}/templates/${templateId}`);
}

/**
 * Get form configuration for a template
 */
export async function getTemplateForm(
    categoryId: string,
    templateId: string
): Promise<CategoryTemplateForm | null> {
    const response = await get<CategoryTemplateForm | null>(
        `/admin/categories/${categoryId}/templates/${templateId}/form`
    );
    if (!response.success) {
        throw new Error(response.error || 'Failed to fetch form');
    }
    return response.data || null;
}

/**
 * Create or update form configuration
 */
export async function upsertTemplateForm(
    categoryId: string,
    templateId: string,
    data: UpsertFormData
): Promise<CategoryTemplateForm> {
    const response = await put<CategoryTemplateForm>(
        `/admin/categories/${categoryId}/templates/${templateId}/form`,
        data
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to save form');
    }
    return response.data;
}

/**
 * Delete form configuration
 */
export async function deleteTemplateForm(
    categoryId: string,
    templateId: string
): Promise<void> {
    await del(`/admin/categories/${categoryId}/templates/${templateId}/form`);
}
