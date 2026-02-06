/**
 * Category Pricing Rules Management Page
 */

import { CategoryPricing } from '@/app/components/features/categories/category-pricing';

export default async function CategoryPricingPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <CategoryPricing categoryId={id} />;
}


