import toast from 'react-hot-toast';

// Success toast
export function toastSuccess(message: string, duration?: number) {
    return toast.success(message, {
        duration: duration || 3000,
        position: 'top-right',
    });
}

// Error toast
export function toastError(message: string, duration?: number) {
    return toast.error(message, {
        duration: duration || 5000,
        position: 'top-right',
    });
}

// Info toast
export function toastInfo(message: string, duration?: number) {
    return toast(message, {
        duration: duration || 4000,
        position: 'top-right',
        icon: 'ℹ️',
    });
}

// Warning toast
export function toastWarning(message: string, duration?: number) {
    return toast(message, {
        duration: duration || 4000,
        position: 'top-right',
        icon: '⚠️',
        style: {
            background: '#fef3c7',
            color: '#92400e',
        },
    });
}

// Loading toast (returns toast ID for dismissing)
export function toastLoading(message: string) {
    return toast.loading(message, {
        position: 'top-right',
    });
}

// Promise toast (handles async operations)
export function toastPromise<T>(
    promise: Promise<T>,
    messages: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: any) => string);
    }
) {
    return toast.promise(promise, messages);
}

// Dismiss toast
export function toastDismiss(toastId?: string) {
    toast.dismiss(toastId);
}

// Dismiss all toasts
export function toastDismissAll() {
    toast.dismiss();
}

