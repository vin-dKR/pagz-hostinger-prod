/**
 * Create Category Page
 * Form to create a new category
 */

import { CreateCategoryForm } from '@/app/components/features/categories/create-category-form';

export default function CreateCategoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Category</h1>
        <p className="mt-2 text-sm text-gray-600">
          Add a new service or product category
        </p>
      </div>

      <CreateCategoryForm />
    </div>
  );
}


