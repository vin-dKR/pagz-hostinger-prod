import { ProductsList } from '@/app/components/features/products/products-list';
import { Button } from '@/app/components/ui/button';
import { ManagementPage } from '@/app/components/layouts/management-page';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function ProductsPage() {
    return (
        <ManagementPage
            section="Catalog"
            title="Products"
            description="Manage pricing, inventory, and visibility across your catalog."
            actions={<Link href="/products/new"><Button className="gap-2"><Plus className="h-4 w-4" />Add product</Button></Link>}
        >
            <ProductsList />
        </ManagementPage>
    );
}
