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
            className={`bg-white rounded-lg border border-gray-200 p-4 mb-3 ${
                isDragging ? 'shadow-lg' : ''
            } ${!carousel.isActive ? 'opacity-60' : ''}`}
        >
            <div className="flex items-center gap-4">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                >
                    <GripVertical className="h-5 w-5" />
                </div>
                <div className="shrink-0">
                    <Image
                        src={carousel.imageUrl}
                        alt={carousel.alt || 'Carousel image'}
                        width={120}
                        height={80}
                        className="rounded-md object-cover"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                            {carousel.alt || 'Carousel Item'}
                        </h3>
                        {carousel.category && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                {carousel.category.name}
                            </span>
                        )}
                        {!carousel.isActive && (
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                Inactive
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500">
                        Order: {carousel.displayOrder} • Created: {formatDate(carousel.createdAt)}
                    </p>
                    {carousel.category && (
                        <p className="text-xs text-gray-400 mt-1">
                            Links to: /services/{carousel.category.slug}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleActive(carousel)}
                        title={carousel.isActive ? 'Deactivate' : 'Activate'}
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
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(carousel)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Carousel Items ({carousels.length})
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
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
                        <div className="text-center py-12">
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
                                {carousels.map((carousel) => (
                                    <SortableItem
                                        key={carousel.id}
                                        carousel={carousel}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        onToggleActive={handleToggleActive}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}

                    {isReordering && (
                        <div className="mt-4 text-sm text-gray-500 text-center">
                            Saving order...
                        </div>
                    )}
                </CardContent>
            </Card>
            {ConfirmDialog}
        </>
    );
}
