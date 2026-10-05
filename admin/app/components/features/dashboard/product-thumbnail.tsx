'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { getPublicFileUrl } from '@/lib/utils/fileUrl';

export function ProductThumbnail({ imageUrl }: { imageUrl?: string }) {
    const [failed, setFailed] = useState(false);

    if (!imageUrl || failed) {
        return (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-background-secondary)]" aria-hidden="true">
                <Package className="h-4 w-4 text-[var(--color-foreground-tertiary)]" />
            </div>
        );
    }

    return <Image src={getPublicFileUrl(imageUrl)} alt="" width={36} height={36} onError={() => setFailed(true)} className="h-9 w-9 shrink-0 rounded-md border border-[var(--color-border)] object-cover" />;
}
