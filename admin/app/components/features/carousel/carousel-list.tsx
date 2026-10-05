/**
 * Carousel List Component
 * Displays list of carousel items with drag-and-drop reordering
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { PageLoading } from '@/app/components/ui/loading';
import { Alert } from '@/app/components/ui/alert';
import {
    getCarouselsApi,
    deleteCarouselApi,
    reorderCarouselsApi,
    type Carousel,
} from '@/lib/api/carousel.service';
import { formatDate } from '@/lib/utils/format';
import { Button } from '@/app/components/ui/button';
import { GripVertical, Trash2, Edit, Eye, EyeOff, Plus } from 'lucide-react';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastPromise } from '@/lib/utils/toast';
import Image from 'next/image';
import Link from 'next/link';
import { getPublicFileUrl } from '@/lib/utils/fileUrl';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
    carousel: Carousel;
    onEdit: (carousel: Carousel) => void;
    onDelete: (carousel: Carousel) => void;
    onToggleActive: (carousel: Carousel) => void;
}

function SortableItem({ carousel, onEdit, onDelete, onToggleActive }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: carousel.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative overflow-hidden rounded-xl border border-[#dedede] bg-[linear-gradient(180deg,#fff,#fafafa)] p-3 shadow-[0_1px_3px_#00000005,inset_0_0_0_1px_#fff] transition-[border-color,transform,box-shadow] hover:border-[#c4c4c4] ${
                isDragging ? 'relative z-10 shadow-[var(--shadow-md)]' : ''
            } ${!carousel.isActive ? 'opacity-60' : ''}`}
        >
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
                <div
                    {...attributes}
                    {...listeners}
                    className="flex h-12 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-[#e9e9e9] bg-[#f6f6f6] text-[#b1b1b1] shadow-[inset_0_1px_1px_#fff] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] active:cursor-grabbing"
                    aria-label={`Reorder ${carousel.alt || 'carousel item'}`}
                >
                    <GripVertical className="h-5 w-5" />
                </div>
                <div className="shrink-0">
                    <Image
                        src={getPublicFileUrl(carousel.imageUrl)}
                        alt={carousel.alt || 'Carousel image'}
                        width={120}
                        height={80}
                        className="h-[70px] w-[108px] rounded-lg border border-[var(--color-border)] object-cover ring-[3px] ring-[#f0f0f0] sm:h-[78px] sm:w-[138px]"
                    />
                </div>
                <div className="min-w-[150px] flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--color-foreground-tertiary)]">Order {carousel.displayOrder}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-[5px] px-2 py-0.5 text-[10px] font-medium ${carousel.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--color-background-tertiary)] text-[var(--color-foreground-secondary)]'}`}>
                            <span aria-hidden className={`h-1 w-1 rounded-full ${carousel.isActive ? 'bg-emerald-500' : 'bg-[#aaa]'}`} />
                            {carousel.isActive ? 'Live' : 'Inactive'}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[15px] font-semibold text-[var(--color-foreground)]">
                            {carousel.alt || 'Carousel Item'}
                        </h3>
                        {carousel.category && (
                            <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-background-tertiary)] px-2 py-0.5 text-[11px] text-[var(--color-foreground-secondary)]">
                                {carousel.category.name}
                            </span>
                        )}
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--color-foreground-secondary)]">
                        Created {formatDate(carousel.createdAt)}
                    </p>
                    {carousel.category && (
                        <p className="mt-1 truncate font-mono text-[11px] text-[var(--color-foreground-tertiary)]">
                            /services/{carousel.category.slug}
                        </p>
                    )}
                </div>
                <div className="ml-auto flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-tertiary)] p-1 sm:ml-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleActive(carousel)}
                        title={carousel.isActive ? 'Deactivate' : 'Activate'}
                        aria-label={carousel.isActive ? 'Deactivate carousel item' : 'Activate carousel item'}
                    >
                        {carousel.isActive ? (
                            <Eye className="h-4 w-4" />
                        ) : (
                            <EyeOff className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(carousel)}
                        title="Edit carousel item"
                        aria-label="Edit carousel item"
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(carousel)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete carousel item"
                        aria-label="Delete carousel item"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function CarouselList() {
    const [carousels, setCarousels] = useState<Carousel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isReordering, setIsReordering] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        loadCarousels();
    }, []);

    const loadCarousels = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getCarouselsApi();
            setCarousels(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load carousels');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = carousels.findIndex((item) => item.id === active.id);
        const newIndex = carousels.findIndex((item) => item.id === over.id);

        const newCarousels = arrayMove(carousels, oldIndex, newIndex);
        setCarousels(newCarousels);

        // Update display orders
        const reorderedItems = newCarousels.map((item, index) => ({
            id: item.id,
            displayOrder: index,
        }));

        try {
            setIsReordering(true);
            await toastPromise(
                reorderCarouselsApi({ items: reorderedItems }),
                {
                    loading: 'Reordering carousel items...',
                    success: 'Carousel items reordered successfully',
                    error: 'Failed to reorder carousel items',
                }
            );
        } catch (err) {
            // Revert on error
            setCarousels(carousels);
            console.error('Failed to reorder:', err);
        } finally {
            setIsReordering(false);
        }
    };

    const handleDelete = async (carousel: Carousel) => {
        await confirm({
            title: 'Delete Carousel Item',
            description: `Are you sure you want to delete this carousel item? This action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    await toastPromise(
                        deleteCarouselApi(carousel.id),
                        {
                            loading: 'Deleting carousel item...',
                            success: 'Carousel item deleted successfully',
                            error: 'Failed to delete carousel item',
                        }
                    );
                    await loadCarousels();
                } catch (err) {
                    console.error('Failed to delete:', err);
                }
            },
        });
    };

    const handleToggleActive = async (carousel: Carousel) => {
        try {
            const { updateCarouselApi } = await import('@/lib/api/carousel.service');
            await toastPromise(
                updateCarouselApi(carousel.id, { isActive: !carousel.isActive }),
                {
                    loading: carousel.isActive ? 'Deactivating...' : 'Activating...',
                    success: carousel.isActive ? 'Carousel item deactivated' : 'Carousel item activated',
                    error: 'Failed to update carousel item',
                }
            );
            await loadCarousels();
        } catch (err) {
            console.error('Failed to toggle active:', err);
        }
    };

    const handleEdit = (carousel: Carousel) => {
        // Navigate to edit page or open modal
        window.location.href = `/carousels/${carousel.id}/edit`;
    };

    if (isLoading) {
        return <PageLoading />;
    }

    if (error) {
        return (
            <Alert variant="error">
                {error}
            </Alert>
        );
    }

    return (
        <>
            <Card>
                <CardContent className="p-0">
                    <div className="admin-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
                                Carousel Items ({carousels.length})
                            </h2>
                            <p className="mt-1 text-xs text-[var(--color-foreground-secondary)]">
                                Drag items to reorder. Changes are saved automatically.
                            </p>
                        </div>
                        <Link href="/carousels/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Carousel Item
                            </Button>
                        </Link>
                    </div>

                    {carousels.length === 0 ? (
                        <div className="px-5 py-16 text-center">
                            <p className="text-gray-500 mb-4">
                                No carousel items found. Create your first carousel item to get started.
                            </p>
                            <Link href="/carousels/new">
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Carousel Item
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={carousels.map((c) => c.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2.5 bg-[#f3f3f3] p-3">
                                    {carousels.map((carousel) => (
                                        <SortableItem
                                            key={carousel.id}
                                            carousel={carousel}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                            onToggleActive={handleToggleActive}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}

                    {isReordering && (
                        <div className="border-t border-[var(--color-border)] px-5 py-3 text-center text-xs text-[var(--color-foreground-secondary)]">
                            Saving order...
                        </div>
                    )}
                </CardContent>
            </Card>
            {ConfirmDialog}
        </>
    );
}
