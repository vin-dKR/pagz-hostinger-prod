/**
 * Category Specifications Management Page
 */

import { CategorySpecifications } from '@/app/components/features/categories/category-specifications';

export default async function CategorySpecificationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CategorySpecifications categoryId={id} />;
}


