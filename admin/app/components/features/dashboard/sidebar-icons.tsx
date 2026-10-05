import type { ReactNode, SVGProps } from 'react';

export type SidebarIconProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'name'> & {
    size?: number;
};

const glyphs = {
    dashboard: (
        <>
            <rect x="2" y="2" width="7" height="7" rx="2" />
            <rect x="11" y="2" width="7" height="4.5" rx="1.7" opacity="0.5" />
            <rect x="2" y="11" width="7" height="7" rx="2" opacity="0.5" />
            <rect x="11" y="8.5" width="7" height="9.5" rx="2" />
        </>
    ),
    products: (
        <>
            <path d="M2.5 6.1 10 2l7.5 4.1L10 10.2 2.5 6.1Z" opacity="0.45" />
            <path d="M2.5 8.1 9 11.7v6.1L3.6 14.9a2 2 0 0 1-1.1-1.8v-5Z" />
            <path d="m17.5 8.1-6.5 3.6v6.1l5.4-2.9a2 2 0 0 0 1.1-1.8v-5Z" />
        </>
    ),
    categories: (
        <>
            <path d="M3.7 4h4.2l1.6 2H16a2 2 0 0 1 2 2v7.7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5.7A1.7 1.7 0 0 1 3.7 4Z" />
            <path d="M5.5 9.7h9m-9 3h6" fill="none" stroke="var(--color-card, white)" strokeLinecap="round" strokeWidth="1.4" opacity="0.8" />
        </>
    ),
    carousel: (
        <>
            <path d="M5.5 2.2h10.1a2 2 0 0 1 2 2v9.4h-1.8V5.1a1 1 0 0 0-1-1H5.5V2.2Z" opacity="0.45" />
            <path d="M4.2 5.4h9.3a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H4.2a2 2 0 0 1-2-2V7.4a2 2 0 0 1 2-2Zm.1 10.5h9.2l-3.2-4.2-2.1 2.2-1.3-1.4-2.6 3.4Zm7.1-5.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z" fillRule="evenodd" />
        </>
    ),
    orders: (
        <>
            <path d="M5.5 6h9a2 2 0 0 1 2 1.8l.8 8a2 2 0 0 1-2 2.2H4.7a2 2 0 0 1-2-2.2l.8-8A2 2 0 0 1 5.5 6Z" />
            <path d="M7 6V5a3 3 0 1 1 6 0v1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
            <path d="M7.2 11.5h5.6" fill="none" stroke="var(--color-card, white)" strokeLinecap="round" strokeWidth="1.4" opacity="0.75" />
        </>
    ),
    payments: (
        <>
            <rect x="2" y="3" width="16" height="14" rx="2.6" />
            <path d="M2 7.3h16v2.2H2z" opacity="0.45" />
            <rect x="4.7" y="12.1" width="5.8" height="1.7" rx="0.85" fill="var(--color-card, white)" opacity="0.8" />
        </>
    ),
    orphanPayments: (
        <>
            <path d="M3.8 3.2h11.8A2.4 2.4 0 0 1 18 5.6v8.7h-2V7.8H3.8v5.8H2V5a1.8 1.8 0 0 1 1.8-1.8Z" opacity="0.45" />
            <path d="M8.6 10.2a1.7 1.7 0 0 1 2.8 0l4.9 6.5A1.6 1.6 0 0 1 15 19H5a1.6 1.6 0 0 1-1.3-2.3l4.9-6.5Z" />
            <path d="M10 13.2v2.1m0 1.8h.01" fill="none" stroke="var(--color-card, white)" strokeLinecap="round" strokeWidth="1.4" />
        </>
    ),
    shipping: (
        <>
            <path d="M2 4h10.5v10H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
            <path d="M13.5 7h2.1a2 2 0 0 1 1.5.7l1.4 1.7a2 2 0 0 1 .5 1.3V14h-5.5V7Z" opacity="0.55" />
            <circle cx="5" cy="15.3" r="2.1" />
            <circle cx="15.5" cy="15.3" r="2.1" />
        </>
    ),
    users: (
        <>
            <circle cx="7.6" cy="6.4" r="3.2" />
            <path d="M2.1 16.5a5.5 5.5 0 0 1 11 0v.4a1.1 1.1 0 0 1-1.1 1.1H3.2a1.1 1.1 0 0 1-1.1-1.1v-.4Z" />
            <path d="M14.2 3.9a2.8 2.8 0 0 1 .2 5.3 4.3 4.3 0 0 0-1.4-5.1 2.7 2.7 0 0 1 1.2-.2Zm.3 7.3a4.7 4.7 0 0 1 3.4 5.1 1 1 0 0 1-1 1h-2.1a6.9 6.9 0 0 0-1.5-5.7c.4-.2.8-.3 1.2-.4Z" opacity="0.5" />
        </>
    ),
    coupons: (
        <>
            <path d="M3.5 3h13A1.5 1.5 0 0 1 18 4.5v3a2.5 2.5 0 0 0 0 5v3A1.5 1.5 0 0 1 16.5 17h-13A1.5 1.5 0 0 1 2 15.5v-3a2.5 2.5 0 0 0 0-5v-3A1.5 1.5 0 0 1 3.5 3Z" />
            <path d="m7.4 13.4 5.2-6.8M7.6 7.2h.01m4.8 5.6h.01" fill="none" stroke="var(--color-card, white)" strokeLinecap="round" strokeWidth="1.5" />
        </>
    ),
    reviews: (
        <>
            <path d="m10 1.8 2.4 5 5.5.8-4 3.9.9 5.5L10 14.4 5.1 17l.9-5.5-4-3.9 5.5-.8 2.5-5Z" />
            <path d="M5 18.7h10" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" opacity="0.45" />
        </>
    ),
} satisfies Record<string, ReactNode>;

export type SidebarIconName = keyof typeof glyphs;

export function SidebarIcon({ name, size = 18, ...props }: SidebarIconProps & { name: SidebarIconName }) {
    return (
        <svg
            viewBox="0 0 20 20"
            width={size}
            height={size}
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            {glyphs[name]}
        </svg>
    );
}

export const sidebarIcons = {
    dashboard: (props: SidebarIconProps) => <SidebarIcon name="dashboard" {...props} />,
    products: (props: SidebarIconProps) => <SidebarIcon name="products" {...props} />,
    categories: (props: SidebarIconProps) => <SidebarIcon name="categories" {...props} />,
    carousel: (props: SidebarIconProps) => <SidebarIcon name="carousel" {...props} />,
    orders: (props: SidebarIconProps) => <SidebarIcon name="orders" {...props} />,
    payments: (props: SidebarIconProps) => <SidebarIcon name="payments" {...props} />,
    orphanPayments: (props: SidebarIconProps) => <SidebarIcon name="orphanPayments" {...props} />,
    shipping: (props: SidebarIconProps) => <SidebarIcon name="shipping" {...props} />,
    users: (props: SidebarIconProps) => <SidebarIcon name="users" {...props} />,
    coupons: (props: SidebarIconProps) => <SidebarIcon name="coupons" {...props} />,
    reviews: (props: SidebarIconProps) => <SidebarIcon name="reviews" {...props} />,
} as const;
