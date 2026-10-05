import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', isLoading, disabled, children, ...props }, ref) => {
        const baseStyles = 'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] border border-transparent font-semibold tracking-[-0.01em] shadow-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px';

        const variants = {
            default: 'border-[#242424] bg-[linear-gradient(180deg,#414141,#252525)] text-[var(--color-primary-foreground)] hover:brightness-110 shadow-[0_1px_2px_#00000020,inset_0_1px_0_#ffffff25]',
            destructive: 'bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:bg-[var(--color-destructive-hover)]',
            outline: 'border-[#dcdcdc] bg-[linear-gradient(180deg,#ffffff,#f5f5f5)] text-[var(--color-foreground)] hover:border-[#c7c7c7] shadow-[0_1px_2px_#00000008,inset_0_0_0_1px_#ffffff]',
            secondary: 'border-[#dedede] bg-[linear-gradient(180deg,#f6f6f6,#eeeeee)] text-[var(--color-secondary-foreground)] hover:bg-[var(--color-secondary-hover)] shadow-[inset_0_1px_0_#ffffff]',
            ghost: 'text-[var(--color-foreground-secondary)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]',
            link: 'h-auto border-0 p-0 text-[var(--color-primary)] underline-offset-4 hover:underline',
        };

        const sizes = {
            default: 'h-9 px-3.5 text-[13px]',
            sm: 'h-8 px-3 text-xs',
            lg: 'h-10 px-5 text-sm',
            icon: 'h-9 w-9',
        };

        return (
            <button
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizes[size],
                    className
                )}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <>
                        <svg
                            className="mr-2 h-4 w-4 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="3"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        Loading...
                    </>
                ) : (
                    children
                )}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
