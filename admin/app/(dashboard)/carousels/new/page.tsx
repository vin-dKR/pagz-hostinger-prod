/**
 * Create Carousel Page
 */

import { CarouselForm } from '@/app/components/features/carousel/carousel-form';

export default function NewCarouselPage() {
    return (
        <div className="space-y-8 max-w-[1200px]">
            <div>
                <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">Create Carousel Item</h1>
                <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                    Add a new carousel item to the homepage
                </p>
            </div>

            <CarouselForm />
        </div>
    );
}
