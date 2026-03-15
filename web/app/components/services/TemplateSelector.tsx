'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui/button';
import { FileText } from 'lucide-react';

interface TemplateSelectorProps {
    categorySlug: string;
    onTemplateSelect: (templateId: string | null, formData: Record<string, any>, formImages: string[]) => void;
    selectedTemplateId?: string | null;
    selectedFormData?: Record<string, any>;
}

export function TemplateSelector({
    categorySlug,
    onTemplateSelect,
    selectedTemplateId,
}: TemplateSelectorProps) {
    const router = useRouter();

    // Check for template data from sessionStorage when component mounts
    useEffect(() => {
        const storedData = sessionStorage.getItem('selectedTemplateData');
        if (storedData) {
            try {
                const templateData = JSON.parse(storedData);
                onTemplateSelect(
                    templateData.templateId,
                    templateData.formData || {},
                    templateData.formImages || []
                );
                // Clear the stored data after using it
                sessionStorage.removeItem('selectedTemplateData');
            } catch (error) {
                console.error('Error parsing template data:', error);
            }
        }
    }, [onTemplateSelect]);

    const handleChooseTemplate = () => {
        router.push(`/services/${categorySlug}/templates`);
    };

    return (
        <div className="w-full">
            <Button
                type="button"
                variant="outline"
                onClick={handleChooseTemplate}
                className="w-full sm:w-auto"
            >
                <FileText className="mr-2 h-4 w-4" />
                {selectedTemplateId ? 'Change Template' : 'Choose Template'}
            </Button>
            {selectedTemplateId && (
                <p className="mt-2 text-sm text-gray-600">
                    Template selected. Click to change.
                </p>
            )}
        </div>
    );
}
