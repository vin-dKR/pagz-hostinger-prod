/**
 * Category Detail Page
 * Manage basic info and configuration for a category
 */

import { CategoryDetail } from '@/app/components/features/categories/category-detail';

export default async function CategoryDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <CategoryDetail categoryId={id} />;
}


