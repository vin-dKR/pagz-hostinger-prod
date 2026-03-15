import { get } from '../api-client';

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
    options?: Array<{ label: string; value: string }>;
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

/**
 * Get all active templates for a category by slug
 */
export async function getCategoryTemplates(categorySlug: string): Promise<CategoryTemplate[]> {
    const response = await get<CategoryTemplate[]>(`/categories/${categorySlug}/templates`);
    if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch templates');
    }
    return response.data;
}
