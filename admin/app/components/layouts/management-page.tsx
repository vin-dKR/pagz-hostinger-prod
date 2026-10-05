import type { ReactNode } from 'react';

interface ManagementPageProps {
    section: string;
    title: string;
    description: string;
    actions?: ReactNode;
    children: ReactNode;
}

/** Shared page frame for the existing admin management screens. */
export function ManagementPage({ section, title, description, actions, children }: ManagementPageProps) {
    return (
        <div className="admin-management-page mx-auto w-full max-w-[1620px] space-y-3 pb-8">
            <header className="py-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                            <h1 className="tracking-[-0.035em] text-[var(--color-foreground)]">{title}</h1>
                            <span className="hidden rounded border border-[#e2e2e2] bg-[#f1f1f1] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.04em] text-[#8a8a8a] sm:inline">{section}</span>
                        </div>
                        <p className="mt-1 hidden max-w-2xl text-[11px] leading-4 text-[var(--color-foreground-secondary)] sm:block">{description}</p>
                    </div>
                    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:[&_button]:h-8 max-sm:[&_button]:text-xs">{actions}</div>}
                </div>
            </header>
            <div className="space-y-3">{children}</div>
        </div>
    );
}
