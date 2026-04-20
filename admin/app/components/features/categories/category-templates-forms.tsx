'use client';

/**
 * Category Templates & Forms Management
 */

import { useEffect, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/app/components/ui/dialog';
import {
    getCategoryTemplates,
    createCategoryTemplate,
    updateCategoryTemplate,
    deleteCategoryTemplate,
    getTemplateForm,
    upsertTemplateForm,
    type CategoryTemplate,
    type FormField,
} from '@/lib/api/categoryTemplates.service';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastSuccess } from '@/lib/utils/toast';
import { getPublicFileUrl } from '@/lib/utils/fileUrl';
import { Plus, Edit, Trash2, FileText, X, GripVertical } from 'lucide-react';

interface CategoryTemplatesFormsProps {
    categoryId: string;
}

const FIELD_TYPES: { value: FormField['type']; label: string }[] = [
    { value: 'text', label: 'Text Input' },
    { value: 'number', label: 'Number Input' },
    { value: 'email', label: 'Email Input' },
    { value: 'phone', label: 'Phone Input' },
    { value: 'textarea', label: 'Textarea' },
    { value: 'select', label: 'Select Dropdown' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'file', label: 'File Upload' },
];

export function CategoryTemplatesForms({ categoryId }: CategoryTemplatesFormsProps) {
    const [templates, setTemplates] = useState<CategoryTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { confirm, ConfirmDialog } = useConfirm();

    // Template form state
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<CategoryTemplate | null>(null);
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [templateForm, setTemplateForm] = useState<{
        name: string;
        description: string;
        previewImageUrl: string;
        displayOrder: number;
        isActive: boolean;
    }>({
        name: '',
        description: '',
        previewImageUrl: '',
        displayOrder: 0,
        isActive: true,
    });

    // Form builder state
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<CategoryTemplate | null>(null);
    const [formFields, setFormFields] = useState<FormField[]>([]);
    const [requiresImageUpload, setRequiresImageUpload] = useState(false);
    const [imageUploadRequired, setImageUploadRequired] = useState(false);
    const [savingForm, setSavingForm] = useState(false);
    const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
    const [fieldModalOpen, setFieldModalOpen] = useState(false);
    const [fieldForm, setFieldForm] = useState<FormField>({
        type: 'text',
        label: '',
        placeholder: '',
        isRequired: false,
        displayOrder: 0,
    });

    useEffect(() => {
        loadTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryId]);

    const loadTemplates = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getCategoryTemplates(categoryId);
            setTemplates(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const resetTemplateForm = () => {
        setTemplateForm({
            name: '',
            description: '',
            previewImageUrl: '',
            displayOrder: templates.length,
            isActive: true,
        });
        setEditingTemplate(null);
    };

    const openTemplateModal = (template?: CategoryTemplate) => {
        if (template) {
            setEditingTemplate(template);
            setTemplateForm({
                name: template.name,
                description: template.description || '',
                previewImageUrl: template.previewImageUrl || '',
                displayOrder: template.displayOrder,
                isActive: template.isActive,
            });
        } else {
            resetTemplateForm();
        }
        setTemplateModalOpen(true);
    };

    const handleSaveTemplate = async (e: FormEvent) => {
        e.preventDefault();
        try {
            setSavingTemplate(true);
            setError(null);

            if (editingTemplate) {
                const updated = await updateCategoryTemplate(categoryId, editingTemplate.id, templateForm);
                setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                toastSuccess('Template updated successfully');
            } else {
                const created = await createCategoryTemplate(categoryId, templateForm);
                setTemplates((prev) => [...prev, created]);
                toastSuccess('Template created successfully');
            }

            setTemplateModalOpen(false);
            resetTemplateForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save template');
        } finally {
            setSavingTemplate(false);
        }
    };

    const handleDeleteTemplate = async (template: CategoryTemplate) => {
        await confirm({
            title: 'Delete Template',
            description: `Are you sure you want to delete "${template.name}"? This will also delete the associated form.`,
            variant: 'destructive',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    await deleteCategoryTemplate(categoryId, template.id);
                    setTemplates((prev) => prev.filter((t) => t.id !== template.id));
                    toastSuccess('Template deleted successfully');
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to delete template');
                }
            },
        });
    };

    const openFormModal = async (template: CategoryTemplate) => {
        setSelectedTemplate(template);
        try {
            const form = await getTemplateForm(categoryId, template.id);
            if (form) {
                setFormFields(form.fields || []);
                setRequiresImageUpload(form.requiresImageUpload);
                setImageUploadRequired(form.imageUploadRequired);
            } else {
                setFormFields([]);
                setRequiresImageUpload(false);
                setImageUploadRequired(false);
            }
            setFormModalOpen(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load form');
        }
    };

    const handleSaveForm = async () => {
        if (!selectedTemplate) return;

        try {
            setSavingForm(true);
            setError(null);

            await upsertTemplateForm(categoryId, selectedTemplate.id, {
                fields: formFields,
                requiresImageUpload,
                imageUploadRequired,
            });

            toastSuccess('Form saved successfully');
            setFormModalOpen(false);
            await loadTemplates(); // Reload to get updated form data
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save form');
        } finally {
            setSavingForm(false);
        }
    };

    const resetFieldForm = () => {
        setFieldForm({
            type: 'text',
            label: '',
            placeholder: '',
            isRequired: false,
            displayOrder: formFields.length,
        });
        setEditingFieldIndex(null);
        setFieldModalOpen(false);
    };

    const openFieldModal = (index?: number) => {
        if (index !== undefined && formFields[index]) {
            setEditingFieldIndex(index);
            setFieldForm({ ...formFields[index] });
        } else {
            setFieldForm({
                type: 'text',
                label: '',
                placeholder: '',
                isRequired: false,
                displayOrder: formFields.length,
            });
            setEditingFieldIndex(null);
        }
        setFieldModalOpen(true);
    };

    const handleSaveField = () => {
        if (editingFieldIndex !== null) {
            // Update existing field
            const updated = [...formFields];
            updated[editingFieldIndex] = { ...fieldForm, displayOrder: editingFieldIndex };
            setFormFields(updated);
        } else {
            // Add new field
            setFormFields([...formFields, { ...fieldForm, displayOrder: formFields.length }]);
        }
        resetFieldForm();
    };

    const handleDeleteField = (index: number) => {
        setFormFields(formFields.filter((_, i) => i !== index).map((f, i) => ({ ...f, displayOrder: i })));
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        if (
            (direction === 'up' && index === 0) ||
            (direction === 'down' && index === formFields.length - 1)
        ) {
            return;
        }

        const newFields = [...formFields];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        const field1 = newFields[index];
        const field2 = newFields[newIndex];
        if (field1 && field2) {
            [newFields[index], newFields[newIndex]] = [field2, field1];
            newFields.forEach((f, i) => {
                f.displayOrder = i;
            });
            setFormFields(newFields);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[200px] items-center justify-center">
                <p className="text-sm text-gray-500">Loading templates...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && <Alert variant="error">{error}</Alert>}

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold">Templates & Forms</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Create templates and configure dynamic forms for users to fill when selecting templates.
                    </p>
                </div>
                <Button onClick={() => openTemplateModal()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                </Button>
            </div>

            {templates.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <FileText className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No templates yet</h3>
                        <p className="mt-2 text-sm text-gray-500">
                            Get started by creating your first template for this category.
                        </p>
                        <Button className="mt-4" onClick={() => openTemplateModal()}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Template
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                        <Card key={template.id}>
                            <CardHeader>
                                {template.previewImageUrl && (
                                    <img
                                        src={getPublicFileUrl(template.previewImageUrl)}
                                        alt={template.name}
                                        className="mb-4 h-32 w-full rounded-lg object-cover"
                                    />
                                )}
                                <CardTitle className="text-lg">{template.name}</CardTitle>
                                {template.description && (
                                    <p className="mt-2 text-sm text-gray-600">{template.description}</p>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openFormModal(template)}
                                        className="flex-1"
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        {template.form ? 'Edit Form' : 'Create Form'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openTemplateModal(template)}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteTemplate(template)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                {template.form && (
                                    <div className="mt-3 text-xs text-gray-500">
                                        {template.form.fields?.length || 0} field(s) configured
                                        {template.form.requiresImageUpload && ' • Image upload enabled'}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Template Create/Edit Modal */}
            <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogClose onClose={() => setTemplateModalOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveTemplate} className="space-y-4">
                        <div>
                            <Label htmlFor="template-name">Name *</Label>
                            <Input
                                id="template-name"
                                value={templateForm.name}
                                onChange={(e) =>
                                    setTemplateForm({ ...templateForm, name: e.target.value })
                                }
                                required
                                placeholder="Template name"
                            />
                        </div>

                        <div>
                            <Label htmlFor="template-description">Description</Label>
                            <textarea
                                id="template-description"
                                className="min-h-[100px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                value={templateForm.description}
                                onChange={(e) =>
                                    setTemplateForm({ ...templateForm, description: e.target.value })
                                }
                                placeholder="Template description"
                            />
                        </div>

                        <div>
                            <Label htmlFor="template-image">Preview Image URL</Label>
                            <Input
                                id="template-image"
                                value={templateForm.previewImageUrl}
                                onChange={(e) =>
                                    setTemplateForm({ ...templateForm, previewImageUrl: e.target.value })
                                }
                                placeholder="https://example.com/image.jpg"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="template-order">Display Order</Label>
                                <Input
                                    id="template-order"
                                    type="number"
                                    value={templateForm.displayOrder}
                                    onChange={(e) =>
                                        setTemplateForm({
                                            ...templateForm,
                                            displayOrder: Number(e.target.value) || 0,
                                        })
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <input
                                    id="template-active"
                                    type="checkbox"
                                    checked={templateForm.isActive}
                                    onChange={(e) =>
                                        setTemplateForm({ ...templateForm, isActive: e.target.checked })
                                    }
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <Label htmlFor="template-active">Active</Label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setTemplateModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" isLoading={savingTemplate}>
                                {editingTemplate ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Form Builder Modal */}
            <Dialog open={formModalOpen} onOpenChange={setFormModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogClose onClose={() => setFormModalOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>
                            Form Builder: {selectedTemplate?.name}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Form Fields List */}
                        <div>
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-lg font-medium">Form Fields</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openFieldModal()}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Field
                                </Button>
                            </div>

                            {formFields.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                                    <p className="text-sm text-gray-500">No fields yet. Add your first field.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {formFields.map((field, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 rounded-lg border border-gray-200 p-3"
                                        >
                                            <GripVertical className="h-5 w-5 text-gray-400" />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium">{field.label}</span>
                                                    <span className="text-xs text-gray-500">
                                                        ({field.type})
                                                    </span>
                                                    {field.isRequired && (
                                                        <span className="text-xs text-red-600">*</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => moveField(index, 'up')}
                                                    disabled={index === 0}
                                                >
                                                    ↑
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => moveField(index, 'down')}
                                                    disabled={index === formFields.length - 1}
                                                >
                                                    ↓
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openFieldModal(index)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDeleteField(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Image Upload Configuration */}
                        <div className="rounded-lg border border-gray-200 p-4">
                            <h3 className="mb-4 text-lg font-medium">Image Upload Configuration</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        id="requires-image-upload"
                                        type="checkbox"
                                        checked={requiresImageUpload}
                                        onChange={(e) => {
                                            setRequiresImageUpload(e.target.checked);
                                            if (!e.target.checked) {
                                                setImageUploadRequired(false);
                                            }
                                        }}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <Label htmlFor="requires-image-upload">Require Image Upload</Label>
                                </div>
                                {requiresImageUpload && (
                                    <div className="ml-6 flex items-center gap-2">
                                        <input
                                            id="image-upload-required"
                                            type="checkbox"
                                            checked={imageUploadRequired}
                                            onChange={(e) => setImageUploadRequired(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <Label htmlFor="image-upload-required">
                                            Image Upload is Mandatory
                                        </Label>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSaveForm} isLoading={savingForm}>
                                Save Form
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Field Configuration Modal */}
            <Dialog open={fieldModalOpen} onOpenChange={setFieldModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogClose onClose={() => resetFieldForm()} />
                    <DialogHeader>
                        <DialogTitle>
                            {editingFieldIndex !== null ? 'Edit Field' : 'Add Field'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="field-type">Field Type *</Label>
                            <select
                                id="field-type"
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                value={fieldForm.type}
                                onChange={(e) =>
                                    setFieldForm({
                                        ...fieldForm,
                                        type: e.target.value as FormField['type'],
                                        options: e.target.value === 'select' ? [] : undefined,
                                    })
                                }
                            >
                                {FIELD_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label htmlFor="field-label">Label *</Label>
                            <Input
                                id="field-label"
                                value={fieldForm.label}
                                onChange={(e) =>
                                    setFieldForm({ ...fieldForm, label: e.target.value })
                                }
                                required
                                placeholder="Field label"
                            />
                        </div>

                        <div>
                            <Label htmlFor="field-placeholder">Placeholder</Label>
                            <Input
                                id="field-placeholder"
                                value={fieldForm.placeholder || ''}
                                onChange={(e) =>
                                    setFieldForm({ ...fieldForm, placeholder: e.target.value })
                                }
                                placeholder="Placeholder text"
                            />
                        </div>

                        {fieldForm.type === 'select' && (
                            <div>
                                <Label>Options *</Label>
                                <div className="space-y-2">
                                    {(fieldForm.options || []).map((option, index) => (
                                        <div key={index} className="flex gap-2">
                                            <Input
                                                placeholder="Label"
                                                value={option.label}
                                                onChange={(e) => {
                                                    const newOptions = [...(fieldForm.options || [])];
                                                    if (newOptions[index]) {
                                                        newOptions[index].label = e.target.value;
                                                        setFieldForm({ ...fieldForm, options: newOptions });
                                                    }
                                                }}
                                            />
                                            <Input
                                                placeholder="Value"
                                                value={option.value}
                                                onChange={(e) => {
                                                    const newOptions = [...(fieldForm.options || [])];
                                                    if (newOptions[index]) {
                                                        newOptions[index].value = e.target.value;
                                                        setFieldForm({ ...fieldForm, options: newOptions });
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const newOptions = (fieldForm.options || []).filter(
                                                        (_, i) => i !== index
                                                    );
                                                    setFieldForm({ ...fieldForm, options: newOptions });
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setFieldForm({
                                                ...fieldForm,
                                                options: [...(fieldForm.options || []), { label: '', value: '' }],
                                            });
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Option
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <input
                                id="field-required"
                                type="checkbox"
                                checked={fieldForm.isRequired || false}
                                onChange={(e) =>
                                    setFieldForm({ ...fieldForm, isRequired: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <Label htmlFor="field-required">Required</Label>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setFieldModalOpen(false);
                                    resetFieldForm();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    handleSaveField();
                                    setFieldModalOpen(false);
                                }}
                                disabled={!fieldForm.label || (fieldForm.type === 'select' && (!fieldForm.options || fieldForm.options.length === 0))}
                            >
                                {editingFieldIndex !== null ? 'Update' : 'Add'} Field
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {ConfirmDialog}
        </div>
    );
}
