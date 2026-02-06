/**
 * Edit Product Page
 * Wraps the multi-step edit wizard for an existing product.
 */

import { EditProductForm } from '@/app/components/features/products/edit-product-form';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <EditProductForm productId={id} />;
}


