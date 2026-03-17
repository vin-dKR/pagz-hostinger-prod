'use client';

/**
 * Create Category Form Component
 */

import { useState, FormEvent, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { createCategory, getCategories, type CreateCategoryData, type Category } from '@/lib/api/categories.service';
import { ParentCategorySelector } from './parent-category-selector';


export function CreateCategoryForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Calculate auto display order (priority)
  const autoDisplayOrder = useMemo(() => {
    if (categories.length === 0) return 1;
    const maxPriority = Math.max(...categories.map((cat) => cat.priority ?? 0), 0);
    return maxPriority + 1;
  }, [categories]);

  // Load all categories to calculate display order
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        // Fetch all categories to get max priority
        const data = await getCategories({ page: 1, limit: 1000 });
        setCategories(data.items);
      } catch (err) {
        // If loading fails, just use default
        console.warn('Failed to load categories for display order calculation:', err);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  const [formData, setFormData] = useState<CreateCategoryData>({
    name: '',
    description: '',
    parentId: undefined,
    priority: autoDisplayOrder,
  });
  
  const [parentId, setParentId] = useState<string | null>(null);

  // Update priority when autoDisplayOrder changes
  useEffect(() => {
    if (!loadingCategories && autoDisplayOrder > 0) {
      setFormData((prev) => ({
        ...prev,
        priority: prev.priority === undefined || prev.priority === 0 ? autoDisplayOrder : prev.priority,
      }));
    }
  }, [autoDisplayOrder, loadingCategories]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload: CreateCategoryData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        parentId: parentId || undefined,
        priority: formData.priority || autoDisplayOrder,
      };

      await createCategory(payload);
      router.push('/categories');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Category</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  name: e.target.value,
                }));
              }}
              placeholder="e.g. PDF Printing"
              required
            />
            <p className="text-xs text-gray-500">Slug will be auto-generated from the name</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Short description of this category"
            />
          </div>

          <ParentCategorySelector
            value={parentId}
            onChange={setParentId}
            label="Parent Category (optional)"
            placeholder="Search for a parent category..."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="priority">Display Order</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority ?? autoDisplayOrder}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: Number(e.target.value) || autoDisplayOrder,
                  }))
                }
                placeholder="Auto-calculated"
                min="0"
              />
              <p className="text-xs text-gray-500">
                Lower values appear first. Auto-set to {autoDisplayOrder} (max + 1), but you can customize it.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create Category
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


