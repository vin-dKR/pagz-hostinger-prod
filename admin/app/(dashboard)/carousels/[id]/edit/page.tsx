/**
 * Edit Carousel Page
 */

import { CarouselForm } from '@/app/components/features/carousel/carousel-form';

export default async function EditCarouselPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    
    return (
        <div className="space-y-8 max-w-[1200px]">
            <div>
                <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">Edit Carousel Item</h1>
                <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                    Update carousel item details
                </p>
            </div>

            <CarouselForm carouselId={id} />
        </div>
    );
}
