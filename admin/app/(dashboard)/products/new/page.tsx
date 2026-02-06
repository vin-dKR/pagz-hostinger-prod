/**
 * Create Product Page
 * Form to create a new product
 */

import { CreateProductForm } from '@/app/components/features/products/create-product-form';

export default function CreateProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Product</h1>
        <p className="mt-2 text-sm text-gray-600">
          Add a new product to your catalog
        </p>
      </div>

      <CreateProductForm />
    </div>
  );
}

