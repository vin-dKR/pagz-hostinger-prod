import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: LucideIcon;
    iconPosition?: 'left' | 'right';
    isLoading?: boolean;
    fullWidth?: boolean;
    useCircularLoader?: boolean; // Use circular loader instead of spinner
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'left',
    isLoading,
    fullWidth,
    className,
    disabled,
    useCircularLoader = false,
    ...props
}) => {
    const variantClasses = {
        primary: 'bg-blue-500 text-white hover:bg-[#008ECC] active:bg-blue-700 shadow-sm hover:shadow',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300 shadow-sm',
        outline: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 active:bg-gray-100 shadow-sm hover:shadow',
        ghost: 'hover:bg-gray-100 hover:text-gray-900',
    };

    const sizeClasses = {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-6 text-base',
        lg: 'h-14 px-8 text-lg',
    };

    return (
        <button
            className={cn(
                'inline-flex items-center justify-center rounded-xl font-medium cursor-pointer',
                'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
                variantClasses[variant],
                sizeClasses[size],
                fullWidth && 'w-full',
                isLoading && 'opacity-70 cursor-wait',
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                useCircularLoader ? (
                    <div className="mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" style={{ width: size === 'lg' ? '20px' : size === 'sm' ? '14px' : '16px', height: size === 'lg' ? '20px' : size === 'sm' ? '14px' : '16px' }}></div>
                ) : (
                    <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )
            )}
            {Icon && iconPosition === 'left' && !isLoading && (
                <Icon className="mr-2 h-4 w-4" />
            )}
            {children}
            {Icon && iconPosition === 'right' && !isLoading && (
                <Icon className="ml-2 h-4 w-4" />
            )}
        </button>
    );
};
