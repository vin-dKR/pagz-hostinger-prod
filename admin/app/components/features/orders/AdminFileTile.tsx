"use client";

/**
 * Admin file tile: thumbnail (image preview / PDF first-page render /
 * generic icon) on the left, filename + download link on the right. Larger
 * than the cart's UploadedFileTile because admin needs to actually read
 * filenames at a glance and previews aid order processing.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, FileText } from "lucide-react";
import { isImageFile } from "@/lib/utils/fileUrl";
import { downloadPublicFile } from "@/lib/utils/file-download";
import { generatePdfThumbnailFromUrl, isPdfFile } from "@/lib/utils/pdf-thumbnail";
import { imageLoader } from "@/lib/utils/image-loader";

interface AdminFileTileProps {
    name: string;
    href: string;
}

const TILE_PX = 72;

export function AdminFileTile({ name, href }: AdminFileTileProps) {
    const [pdfThumb, setPdfThumb] = useState<string | null>(null);
    const isImage = isImageFile(name) || isImageFile(href);
    const isPdf = !isImage && (isPdfFile(name) || isPdfFile(href));

    useEffect(() => {
        let cancelled = false;
        if (isPdf && href) {
            generatePdfThumbnailFromUrl(href).then((thumb) => {
                if (!cancelled) setPdfThumb(thumb);
            });
        } else {
            setPdfThumb(null);
        }
        return () => {
            cancelled = true;
        };
    }, [href, isPdf]);

    return (
        <a
            href={href || "#"}
            target="_blank"
            rel="noopener noreferrer"
            download={name}
            onClick={(e) => {
                // Force a programmatic download so the click doesn't get
                // routed through Next.js's `/orders/[id]` admin page on
                // Hostinger (issue #76). Honor modifier keys / non-primary
                // clicks so right-click "Save link as" + middle-click
                // "Open in new tab" still use the real <a href>.
                if (!href) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                void downloadPublicFile(href, name);
            }}
            className="group flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/40 transition-colors min-w-0"
            title={name}
        >
            <div
                className="relative shrink-0 rounded border border-gray-200 overflow-hidden bg-gray-50"
                style={{ width: TILE_PX, height: TILE_PX }}
            >
                {isImage && href ? (
                    <Image
                        src={href}
                        alt={name}
                        fill
                        className="object-cover"
                        sizes="72px"
                        loader={imageLoader}
                    />
                ) : isPdf && pdfThumb ? (
                    // dataURL → plain <img>, skip next/image optimizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pdfThumb} alt={name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                        <FileText className="h-7 w-7" />
                        {isPdf && (
                            <span className="text-[9px] font-semibold tracking-wide uppercase text-gray-400 leading-none mt-1">
                                PDF
                            </span>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                <p className="mt-0.5 text-xs text-blue-600 group-hover:text-blue-700 flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    Open / download
                </p>
            </div>
        </a>
    );
}
