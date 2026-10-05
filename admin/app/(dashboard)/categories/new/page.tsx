/**
 * Create Category Page
 * Form to create a new category
 */

import { CreateCategoryForm } from '@/app/components/features/categories/create-category-form';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function CreateCategoryPage() {
  return (
    <ManagementPage section="Catalog / Categories" title="Create category" description="Add a new service or product category.">
      <CreateCategoryForm />
    </ManagementPage>
  );
}

