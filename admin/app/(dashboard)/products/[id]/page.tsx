/**
 * Product Detail Page
 * View individual product details
 */

import { ProductDetail } from '@/app/components/features/products/product-detail';
import { getProduct } from '@/lib/server/products-data';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const product = await getProduct(id);
    return <ProductDetail productId={id} initialProduct={product || undefined} />;
}

