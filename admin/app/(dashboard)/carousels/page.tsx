/**
 * Carousels Page
 * Manage homepage carousel items
 */

import { CarouselList } from '@/app/components/features/carousel/carousel-list';

export default function CarouselsPage() {
    return (
        <div className="space-y-8 max-w-[1600px]">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">Carousel</h1>
                    <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                        Manage homepage carousel items
                    </p>
                </div>
            </div>

            <CarouselList />
        </div>
    );
}
