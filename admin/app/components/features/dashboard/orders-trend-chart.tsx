'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'; 
import type { DashboardOverviewResponse } from '@/lib/api/dashboard.service';

interface OrdersTrendChartProps {
    data: DashboardOverviewResponse['timeSeries']['ordersLast30Days'];
    loading?: boolean;
}

function formatDate(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}-${month}-${year}`;
    } catch {
        return dateStr;
    }
}

export function OrdersTrendChart({ data, loading }: OrdersTrendChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const maxCount = data.length > 0 ? Math.max(...data.map((d) => d.count), 1) : 1;
    const totalOrders = data.reduce((sum, d) => sum + d.count, 0);
    
    // Format dates and ensure today is last
    const formattedData = [...data].map(d => ({
        ...d,
        formattedDate: formatDate(d.date),
    }));
    
    // Get today's date formatted
    const today = formatDate(new Date().toISOString());
    
    // Ensure last date is today
    const lastItem = formattedData[formattedData.length - 1];
    if (lastItem) {
        lastItem.formattedDate = today;
    }

    return (
        <Card className="shadow-sm border border-gray-200 hover:shadow-md transition-shadow" aria-label="Orders last 30 days chart">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-semibold">Orders (Last 30 days)</CardTitle>
                    <div className="text-sm text-gray-600">
                        Total: <span className="font-semibold text-gray-900">{totalOrders.toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading && !data.length ? (
                    <div className="h-64 animate-pulse rounded-md bg-gray-100" />
                ) : !data.length ? (
                    <p className="text-sm text-gray-600 text-center py-8">
                        No order data available yet
                    </p>
                ) : (
                    <div className="relative w-full">
                        {/* Tooltip */}
                        {hoveredIndex !== null && formattedData[hoveredIndex] && (
                            <div
                                ref={tooltipRef}
                                className="absolute z-20 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg pointer-events-none whitespace-nowrap"
                                style={{
                                    left: `${(hoveredIndex / formattedData.length) * 100}%`,
                                    top: '-60px',
                                    transform: 'translateX(-50%)',
                                }}
                            >
                                <div className="font-semibold mb-1">{formattedData[hoveredIndex].formattedDate}</div>
                                <div className="text-blue-300">
                                    {formattedData[hoveredIndex].count} {formattedData[hoveredIndex].count === 1 ? 'order' : 'orders'}
                                </div>
                            </div>
                        )}
                        
                        {/* Chart with Y-axis */}
                        <div className="flex gap-2">
                            {/* Y-axis labels */}
                            <div className="flex flex-col justify-between text-xs text-gray-500 h-64 py-3">
                                <span className="font-semibold">{maxCount}</span>
                                <span>{Math.round(maxCount * 0.75)}</span>
                                <span>{Math.round(maxCount * 0.5)}</span>
                                <span>{Math.round(maxCount * 0.25)}</span>
                                <span>0</span>
                            </div>
                            
                            {/* Chart bars */}
                            <div className="flex-1 relative">
                                <div 
                                    className="flex h-64 items-end justify-between gap-1 rounded-md bg-gradient-to-b from-gray-50 to-gray-100 p-3"
                                    style={{ height: '256px' }}
                                >
                                    {formattedData.map((point, index) => {
                                        // Calculate height in pixels (container is 256px - 24px padding = 232px usable)
                                        const usableHeight = 232;
                                        const barHeight = maxCount > 0 
                                            ? Math.max((point.count / maxCount) * usableHeight, point.count > 0 ? 3 : 0)
                                            : 0;
                                        const isHovered = hoveredIndex === index;
                                        
                                        return (
                                            <div
                                                key={point.date}
                                                className="relative flex-1 group cursor-pointer flex items-end"
                                                style={{ height: '100%' }}
                                                onMouseEnter={() => setHoveredIndex(index)}
                                                onMouseLeave={() => setHoveredIndex(null)}
                                            >
                                                <div
                                                    className={`w-full bg-gradient-to-t from-blue-600 to-blue-500 rounded-t transition-all duration-200 ${
                                                        isHovered ? 'opacity-100 ring-2 ring-blue-400 ring-offset-2' : 'opacity-80 hover:opacity-100'
                                                    }`}
                                                    style={{ 
                                                        height: `${barHeight}px`,
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* X-axis labels */}
                                <div className="flex justify-between mt-2 text-xs text-gray-500 px-3">
                                    <span>{formattedData[0]?.formattedDate}</span>
                                    <span>{formattedData[Math.floor(formattedData.length / 2)]?.formattedDate}</span>
                                    <span className="font-semibold">{today}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


