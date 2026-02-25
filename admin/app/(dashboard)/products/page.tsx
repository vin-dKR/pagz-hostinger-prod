/**
 * Products Page
    * Apple-inspired products list page
 */

import { ProductsList } from '@/app/components/features/products/products-list';

export default function ProductsPage() {
    return (
        <div className="space-y-8 max-w-[1600px]">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">Products</h1>
                    <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                        Manage your product catalog
                    </p>
                </div>
            </div>

            <ProductsList />
        </div>
    );
}

