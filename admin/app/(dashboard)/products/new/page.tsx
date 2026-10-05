/**
 * Create Product Page
 * Form to create a new product
 */

import { CreateProductForm } from '@/app/components/features/products/create-product-form';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function CreateProductPage() {
  return (
    <ManagementPage section="Catalog / Products" title="Create product" description="Add a new product to your catalog.">
      <CreateProductForm />
    </ManagementPage>
  );
}
