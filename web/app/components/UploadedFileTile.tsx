"use client";

/**
 * Single uploaded-file row: thumbnail + filename + size metadata.
 *
 * Behaviour:
 *   - Image (jpg/png/...) → next/image preview from the public URL.
 *   - PDF                 → first-page render via pdf-thumbnail (lazy).
 *   - Other / failure     → generic FileText icon.
 *
 * Cached PDF renders are keyed by URL so repeated mounts don't re-render.
 *
 * Layout is horizontal (thumb + text column) so filenames stay readable
 * even when long; previously a centered stack truncated to ~10 chars.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { FileText } from "lucide-react";
import { isImageFile } from "@/lib/utils/fileUrl";
import {
    generatePdfThumbnailFromUrl,
    isPdfFile,
} from "@/lib/utils/pdf-thumbnail";

interface UploadedFileTileProps {
    name: string;
    url: string | undefined;
    /** Optional file metadata to show beneath the name (e.g. "12.3 MB · 482 pages"). */
    meta?: string;
}

const TILE_PX = 44;

export function UploadedFileTile({ name, url, meta }: UploadedFileTileProps) {
    const [pdfThumb, setPdfThumb] = useState<string | null>(null);
    const isImage = isImageFile(name) || (url ? isImageFile(url) : false);
    const isPdf = !isImage && (isPdfFile(name) || (url ? isPdfFile(url) : false));

    useEffect(() => {
        let cancelled = false;
        if (isPdf && url) {
            generatePdfThumbnailFromUrl(url).then((thumb) => {
                if (!cancelled) setPdfThumb(thumb);
            });
        } else {
            setPdfThumb(null);
        }
        return () => {
            cancelled = true;
        };
    }, [url, isPdf]);

    return (
        <div
            className="flex items-center gap-2.5 min-w-0 max-w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 hover:border-gray-300 transition-colors"
            title={name}
        >
            <div
                className="relative shrink-0 rounded overflow-hidden bg-gray-50 border border-gray-100"
                style={{ width: TILE_PX, height: TILE_PX }}
            >
                {isImage && url ? (
                    <Image src={url} alt={name} fill className="object-cover" sizes="44px" />
                ) : isPdf && pdfThumb ? (
                    // pdfThumb is a dataURL — plain <img> avoids the next/image
                    // optimizer pass on a base64 payload.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pdfThumb} alt={name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                        <FileText className="h-5 w-5" />
                        {isPdf && (
                            <span className="text-[8px] font-semibold tracking-wide uppercase text-gray-400 leading-none mt-0.5">
                                PDF
                            </span>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-gray-800">{name}</p>
                {meta && <p className="truncate text-[10px] text-gray-500 mt-0.5">{meta}</p>}
            </div>
        </div>
    );
}
