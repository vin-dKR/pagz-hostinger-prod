'use client';

import { useState } from 'react';
import type { PointerEvent } from 'react';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';
import { useChartWidth } from './use-chart-width';

interface OrdersTrendChartProps {
    data: DashboardOverviewResponse['timeSeries']['ordersLast30Days'];
    loading?: boolean;
}

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date);
}

export function OrdersTrendChart({ data, loading }: OrdersTrendChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const { ref, width } = useChartWidth();
    const chart = { width, height: 228, left: 32, right: 12, top: 14, bottom: 30 };
    const plotWidth = chart.width - chart.left - chart.right;
    const plotHeight = chart.height - chart.top - chart.bottom;
    const totalOrders = data.reduce((sum, item) => sum + item.count, 0);
    const maxCount = Math.max(1, ...data.map((item) => item.count));
    const ceiling = Math.ceil(maxCount / 4) * 4;
    const slot = plotWidth / Math.max(data.length, 1);
    const barWidth = Math.min(18, Math.max(3, slot * 0.6));
    const active = hoveredIndex !== null ? data[hoveredIndex] : null;
    const activeX = hoveredIndex !== null ? chart.left + slot * (hoveredIndex + 0.5) : 0;
    const labelIndices = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];

    const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
        if (!data.length) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width * chart.width;
        const index = Math.floor((x - chart.left) / slot);
        setHoveredIndex(Math.max(0, Math.min(data.length - 1, index)));
    };

    return (
        <div className="min-w-0 rounded-[9px] border border-[#dbdbdb] bg-[#ededed] p-[5px] shadow-[inset_0_1px_0_#ffffff,0_2px_5px_#00000008]" aria-label="Orders for the last 30 days">
            <div className="flex min-h-[65px] flex-wrap items-center justify-between gap-2 px-2.5 py-2">
                <div>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.09em] text-[#737373]">02 / Order volume</p>
                    <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.03em] text-[#252525]">Daily orders</h2>
                </div>
                <div className="text-right">
                    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#777]">30-day total</p>
                    <p className="mt-0.5 text-[21px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[#252525]">{totalOrders.toLocaleString('en-IN')}</p>
                </div>
            </div>

            <div className="rounded-[6px] border border-[#e1e1e1] bg-white p-3 shadow-[inset_0_1px_0_#ffffff,0_1px_2px_#0000000a] sm:px-4">
                <div ref={ref}>
                <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.09em] text-[#929292]"><span>Last 30 days</span><span>Orders / day</span></div>
                {loading && !data.length ? (
                    <div className="h-[228px] animate-pulse rounded-[4px] bg-[#f4f4f4]" />
                ) : !data.length ? (
                    <div className="flex h-[228px] items-center justify-center text-sm text-[#858585]">
                        No order data available yet
                    </div>
                ) : (
                    <div className="min-w-0">
                    <div className="relative min-w-0">
                        {active && hoveredIndex !== null && (
                            <div
                                className="pointer-events-none absolute z-10 min-w-24 rounded-[5px] bg-[#252525] px-3 py-2 text-xs text-white shadow-lg"
                                style={{ left: Math.min(88, Math.max(12, activeX / chart.width * 100)) + '%', top: '12px', transform: 'translateX(-50%)' }}
                            >
                                <p className="opacity-70">{formatDate(active.date)}</p>
                                <p className="mt-1 font-semibold tabular-nums">{active.count} {active.count === 1 ? 'order' : 'orders'}</p>
                            </div>
                        )}
                        <svg
                            viewBox={`0 0 ${chart.width} ${chart.height}`}
                            className="block h-auto w-full"
                            role="img"
                            aria-label="Daily orders for the last 30 days"
                            onPointerMove={handlePointerMove}
                            onPointerLeave={() => setHoveredIndex(null)}
                        >
                            <defs>
                                <pattern id="dashboard-orders-hatch" patternUnits="userSpaceOnUse" width="4" height="4">
                                    <rect width="4" height="4" fill="#c7d6ef" />
                                    <path d="M 0 4 L 4 0" fill="none" stroke="#6c91d8" strokeWidth="1" opacity="0.65" />
                                </pattern>
                            </defs>
                            {[0, 1, 2, 3, 4].map((tick) => {
                                const y = chart.top + tick * plotHeight / 4;
                                return (
                                    <g key={tick}>
                                        <line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} stroke="#e7e7e7" strokeDasharray={tick === 4 ? undefined : '2 5'} />
                                        <text x={chart.left - 8} y={y + 4} textAnchor="end" fill="#919191" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, monospace">
                                            {Math.round(ceiling * (4 - tick) / 4)}
                                        </text>
                                    </g>
                                );
                            })}
                            {data.map((item, index) => {
                                const height = item.count === 0 ? 0 : Math.max(2, item.count / ceiling * plotHeight);
                                const x = chart.left + slot * (index + 0.5) - barWidth / 2;
                                return (
                                    <rect
                                        key={item.date}
                                        x={x}
                                        y={chart.top + plotHeight - height}
                                        width={barWidth}
                                        height={height}
                                        rx={Math.min(3, barWidth / 3)}
                                        fill={hoveredIndex === index ? '#6c91d8' : 'url(#dashboard-orders-hatch)'}
                                        opacity={hoveredIndex === index ? 1 : 0.9}
                                    />
                                );
                            })}
                            {labelIndices.map((index, position) => {
                                const item = data[index];
                                if (!item) return null;
                                return <text key={index} x={chart.left + slot * (index + 0.5)} y={chart.height - 5} textAnchor={position === 0 ? 'start' : position === labelIndices.length - 1 ? 'end' : 'middle'} fill="#919191" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, monospace">{formatDate(item.date)}</text>;
                            })}
                        </svg>
                        <div className="sr-only">
                            {data.map((item) => <span key={item.date}>{formatDate(item.date)}: {item.count} orders. </span>)}
                        </div>
                    </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
