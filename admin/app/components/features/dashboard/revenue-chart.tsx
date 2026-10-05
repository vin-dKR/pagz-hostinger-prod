'use client';

import { useState } from 'react';
import type { PointerEvent } from 'react';
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';
import { useChartWidth } from './use-chart-width';

interface RevenueChartProps {
    data: DashboardOverviewResponse['timeSeries']['revenueLast30Days'];
    loading?: boolean;
}

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date);
}

function formatAxis(value: number) {
    return '₹' + new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const { ref, width } = useChartWidth();
    const chart = { width, height: 228, left: 48, right: 12, top: 14, bottom: 30 };
    const plotWidth = chart.width - chart.left - chart.right;
    const plotHeight = chart.height - chart.top - chart.bottom;
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const largest = Math.max(1, ...data.map((item) => item.revenue));
    const unit = Math.pow(10, Math.floor(Math.log10(largest / 4)));
    const ceiling = Math.ceil(largest / 4 / unit) * unit * 4;
    const points = data.map((item, index) => ({
        x: chart.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth),
        y: chart.top + plotHeight - (item.revenue / ceiling) * plotHeight,
    }));
    const line = points.map((point, index) => (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y).join(' ');
    const baseline = chart.top + plotHeight;
    const firstPoint = points[0];
    const lastPoint = points.at(-1);
    const area = firstPoint && lastPoint ? line + ' L ' + lastPoint.x + ' ' + baseline + ' L ' + firstPoint.x + ' ' + baseline + ' Z' : '';
    const active = hoveredIndex !== null ? points[hoveredIndex] : null;
    const activeItem = hoveredIndex !== null ? data[hoveredIndex] : null;
    const labelIndices = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];

    const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
        if (!data.length) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width * chart.width;
        const index = Math.round((x - chart.left) / plotWidth * (data.length - 1));
        setHoveredIndex(Math.max(0, Math.min(data.length - 1, index)));
    };

    return (
        <div className="min-w-0 rounded-[9px] border border-[#dbdbdb] bg-[#ededed] p-[5px] shadow-[inset_0_1px_0_#ffffff,0_2px_5px_#00000008]" aria-label="Revenue for the last 30 days">
            <div className="flex min-h-[65px] flex-wrap items-center justify-between gap-2 px-2.5 py-2">
                <div>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.09em] text-[#737373]">01 / Sales performance</p>
                    <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.03em] text-[#252525]">Daily revenue</h2>
                </div>
                <div className="text-right">
                    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#777]">30-day total</p>
                    <p className="mt-0.5 text-[21px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[#252525]">
                        ₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            <div className="rounded-[6px] border border-[#e1e1e1] bg-white p-3 shadow-[inset_0_1px_0_#ffffff,0_1px_2px_#0000000a] sm:px-4">
                <div ref={ref}>
                <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.09em] text-[#929292]"><span>Last 30 days</span><span>INR / day</span></div>
                {loading && !data.length ? (
                    <div className="h-[228px] animate-pulse rounded-[4px] bg-[#f4f4f4]" />
                ) : !data.length ? (
                    <div className="flex h-[228px] items-center justify-center text-sm text-[#858585]">
                        No revenue data available yet
                    </div>
                ) : (
                    <div className="min-w-0">
                    <div className="relative min-w-0">
                        {active && activeItem && (
                            <div
                                className="pointer-events-none absolute z-10 min-w-28 rounded-[5px] bg-[#252525] px-3 py-2 text-xs text-white shadow-lg"
                                style={{ left: Math.min(88, Math.max(12, active.x / chart.width * 100)) + '%', top: '12px', transform: 'translateX(-50%)' }}
                            >
                                <p className="opacity-70">{formatDate(activeItem.date)}</p>
                                <p className="mt-1 font-semibold tabular-nums">₹{activeItem.revenue.toLocaleString('en-IN')}</p>
                            </div>
                        )}
                        <svg
                            viewBox={`0 0 ${chart.width} ${chart.height}`}
                            className="block h-auto w-full"
                            role="img"
                            aria-label="Daily revenue for the last 30 days"
                            onPointerMove={handlePointerMove}
                            onPointerLeave={() => setHoveredIndex(null)}
                        >
                            <defs>
                                <pattern id="dashboard-revenue-hatch" patternUnits="userSpaceOnUse" width="6" height="6">
                                    <path d="M 0 6 L 6 0" fill="none" stroke="#7879e8" strokeWidth="0.7" opacity="0.18" />
                                </pattern>
                            </defs>
                            {[0, 1, 2, 3, 4].map((tick) => {
                                const y = chart.top + tick * plotHeight / 4;
                                return (
                                    <g key={tick}>
                                        <line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} stroke="#e7e7e7" strokeDasharray={tick === 4 ? undefined : '2 5'} />
                                        <text x={chart.left - 12} y={y + 4} textAnchor="end" fill="#919191" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, monospace">
                                            {formatAxis(ceiling * (4 - tick) / 4)}
                                        </text>
                                    </g>
                                );
                            })}
                            <path d={area} fill="#7879e8" opacity="0.045" />
                            <path d={area} fill="url(#dashboard-revenue-hatch)" />
                            <path d={line} fill="none" stroke="#7879e8" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                            {points.map((point, index) => data[index]?.revenue ? <circle key={index} cx={point.x} cy={point.y} r="2" fill="#7879e8" stroke="white" strokeWidth="1" /> : null)}
                            {active && (
                                <g>
                                    <line x1={active.x} x2={active.x} y1={chart.top} y2={baseline} stroke="#7879e8" opacity="0.38" strokeDasharray="4 5" />
                                    <circle cx={active.x} cy={active.y} r="5" fill="white" stroke="#7879e8" strokeWidth="2" />
                                </g>
                            )}
                            {labelIndices.map((index, position) => {
                                const point = points[index];
                                const item = data[index];
                                if (!point || !item) return null;
                                return <text key={index} x={point.x} y={chart.height - 5} textAnchor={position === 0 ? 'start' : position === labelIndices.length - 1 ? 'end' : 'middle'} fill="#919191" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, monospace">{formatDate(item.date)}</text>;
                            })}
                        </svg>
                        <div className="sr-only">
                            {data.map((item) => <span key={item.date}>{formatDate(item.date)}: ₹{item.revenue.toLocaleString('en-IN')}. </span>)}
                        </div>
                    </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
