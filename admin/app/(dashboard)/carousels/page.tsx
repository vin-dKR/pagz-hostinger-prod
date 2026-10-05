/**
 * Carousels Page
 * Manage homepage carousel items
 */

import { CarouselList } from '@/app/components/features/carousel/carousel-list';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function CarouselsPage() {
    return (
        <ManagementPage section="Content / Homepage" title="Carousel" description="Curate the banners shown on your storefront homepage.">
            <CarouselList />
        </ManagementPage>
    );
}
