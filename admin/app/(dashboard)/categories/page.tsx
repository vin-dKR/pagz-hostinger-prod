/**
 * Categories Page
 * Apple-inspired categories list page
 */

import { CategoriesList } from '@/app/components/features/categories/categories-list';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function CategoriesPage() {
    return (
        <ManagementPage
            section="Catalog / Categories"
            title="Categories"
            description="Organize the product catalog and its category structure."
            actions={
                <Link href="/categories/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Category
                    </Button>
                </Link>
            }
        >
            <CategoriesList />
        </ManagementPage>
    );
}
