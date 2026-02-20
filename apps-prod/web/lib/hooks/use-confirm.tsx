import { useState } from 'react';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';

interface ConfirmOptions {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
    onConfirm: () => void | Promise<void>;
}

export function useConfirm() {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);

    const confirm = (opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setOptions({
                ...opts,
                onConfirm: async () => {
                    await opts.onConfirm();
                    setIsOpen(false);
                    resolve(true);
                },
            });
            setIsOpen(true);
        });
    };

    const handleCancel = () => {
        setIsOpen(false);
        setOptions(null);
    };

    const ConfirmDialogComponent = options ? (
        <ConfirmDialog
            open={isOpen}
            onClose={handleCancel}
            onConfirm={options.onConfirm}
            title={options.title}
            description={options.description}
            confirmText={options.confirmText}
            cancelText={options.cancelText}
            variant={options.variant}
        />
    ) : null;

    return { confirm, ConfirmDialog: ConfirmDialogComponent };
}

