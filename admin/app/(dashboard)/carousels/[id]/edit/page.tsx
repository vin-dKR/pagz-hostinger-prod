/**
 * Edit Carousel Page
 */

import { CarouselForm } from '@/app/components/features/carousel/carousel-form';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default async function EditCarouselPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    
    return (
        <ManagementPage section="Content / Homepage" title="Edit carousel item" description="Update carousel item details.">
            <CarouselForm carouselId={id} />
        </ManagementPage>
    );
}
