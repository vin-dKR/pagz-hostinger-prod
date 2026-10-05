import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';
import { Trophy } from 'lucide-react';
import { ProductThumbnail } from './product-thumbnail';

interface TopProductsProps {
    topProducts: DashboardOverviewResponse['topProducts'];
    loading?: boolean;
}

export function TopProducts({ topProducts, loading }: TopProductsProps) {
    const maxRevenue = Math.max(0, ...topProducts.map((product) => product.totalRevenue));

    return (
        <div className="min-w-0 rounded-[9px] border border-[#dbdbdb] bg-[#ededed] p-[5px] shadow-[inset_0_1px_0_#ffffff,0_2px_5px_#00000008]">
            <div className="flex min-h-[54px] items-center justify-between gap-3 px-2.5 py-2">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[#dedede] bg-white text-[#565656] shadow-[0_1px_1px_#0000000a]" aria-hidden="true"><Trophy className="h-4 w-4" /></span>
                    <div>
                        <h2 className="text-sm font-semibold tracking-[-0.02em] text-[#252525]">Top products</h2>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[#858585]">By orders and revenue</p>
                    </div>
                </div>
            </div>
            {loading && !topProducts.length ? (
                <div className="space-y-3 rounded-[6px] border border-[#e1e1e1] bg-white p-5">
                    {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-[4px] bg-[#f1f1f1]" />)}
                </div>
            ) : !topProducts.length ? (
                <div className="rounded-[6px] border border-[#e1e1e1] bg-white px-5 py-12 text-center text-sm text-[#858585]">No top products data available yet</div>
            ) : (
                <div className="divide-y divide-[#ececec] rounded-[6px] border border-[#e1e1e1] bg-white px-4 shadow-[inset_0_1px_0_#ffffff,0_1px_2px_#0000000a]">
                    {topProducts.slice(0, 10).map((product, index) => (
                        <div key={product.id} className="flex min-w-0 items-center gap-3 py-2.5">
                            <span className={'w-4 shrink-0 font-mono text-[10px] font-semibold tabular-nums ' + (index < 3 ? 'text-[#565ba8]' : 'text-[#a0a0a0]')}>{String(index + 1).padStart(2, '0')}</span>
                            <ProductThumbnail imageUrl={product.imageUrl} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-[var(--color-foreground)]" title={product.name}>{product.name}</p>
                                <p className="mt-0.5 text-[11px] text-[var(--color-foreground-tertiary)]">{product.totalOrders} orders</p>
                                <div className="mt-1.5 flex h-[5px] gap-[2px] overflow-hidden" aria-hidden="true">
                                    {Array.from({ length: 20 }).map((_, segment) => <span key={segment} className="h-full min-w-0 flex-1 rounded-[1px]" style={{ backgroundColor: segment < (maxRevenue > 0 ? product.totalRevenue / maxRevenue * 20 : 0) ? '#7879e8' : '#e8e8e8' }} />)}
                                </div>
                            </div>
                            <p className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-foreground)]">
                                ₹{product.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
