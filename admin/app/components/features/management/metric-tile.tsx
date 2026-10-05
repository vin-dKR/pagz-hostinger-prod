import type { ReactNode } from 'react';

interface MetricTileProps {
    label: string;
    value: ReactNode;
    detail?: ReactNode;
    emphasis?: 'default' | 'positive' | 'warning';
}

export function MetricTile({ label, value, detail, emphasis = 'default' }: MetricTileProps) {
    const valueColor = emphasis === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-foreground)]';

    return (
        <div className="min-w-0 bg-[#f3f3f3] p-1">
            <p className="flex min-h-7 items-center px-3 text-[11px] font-medium text-[var(--color-foreground-secondary)]">{label}</p>
            <div className="flex min-h-[82px] min-w-0 flex-col justify-between rounded-lg border border-[#e6e6e6] bg-white px-3 py-3 shadow-[0_1px_1px_#00000005]">
                <p className={`truncate text-[22px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[26px] ${valueColor}`}>{value}</p>
                {detail && <p className="mt-2 min-h-4 text-[11px] leading-4 text-[var(--color-foreground-tertiary)]">{detail}</p>}
            </div>
        </div>
    );
}

export function MetricStrip({ children }: { children: ReactNode }) {
    return (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-[#e3e3e3] bg-[#e8e8e8] p-1 shadow-[0_1px_3px_#00000006,inset_0_0_0_1px_#fff] xl:grid-cols-4">
            {children}
        </div>
    );
}
