/**
 * Create Carousel Page
 */

import { CarouselForm } from '@/app/components/features/carousel/carousel-form';
import { ManagementPage } from '@/app/components/layouts/management-page';

export default function NewCarouselPage() {
    return (
        <ManagementPage section="Content / Homepage" title="Create carousel item" description="Add a new carousel item to the homepage.">
            <CarouselForm />
        </ManagementPage>
    );
}
