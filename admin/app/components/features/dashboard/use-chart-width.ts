'use client';

import { useEffect, useRef, useState } from 'react';

/** Keep SVG coordinates at the rendered width so labels stay readable at every breakpoint. */
export function useChartWidth() {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(800);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const update = () => setWidth(Math.max(240, element.clientWidth));
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return { ref, width };
}
