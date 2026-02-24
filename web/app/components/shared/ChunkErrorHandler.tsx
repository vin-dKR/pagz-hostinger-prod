"use client";

import { useEffect, useRef } from "react";

/**
 * ChunkErrorHandler
 * Handles Next.js chunk loading errors gracefully by retrying or reloading the page
 * This is especially important for production deployments where chunks might not be available immediately
 */
export default function ChunkErrorHandler() {
    const retryCountRef = useRef(0);
    const maxRetries = 3;

    useEffect(() => {
        // Handle chunk loading errors
        const handleChunkError = (event: ErrorEvent) => {
            const error = event.error;
            const target = event.target as HTMLElement;
            
            // Check if it's a chunk loading error
            const isChunkError = 
                error?.name === 'ChunkLoadError' ||
                error?.message?.includes('Failed to load chunk') ||
                error?.message?.includes('Loading chunk') ||
                (error?.message && typeof error.message === 'string' && error.message.includes('chunk')) ||
                (target?.tagName === 'SCRIPT' && target.getAttribute('src')?.includes('_next/static/chunks'));

            if (isChunkError) {
                console.warn('[ChunkErrorHandler] Chunk loading error detected:', {
                    error,
                    target: target?.tagName,
                    src: (target as HTMLScriptElement)?.src,
                });

                // Prevent too many retries
                if (retryCountRef.current >= maxRetries) {
                    console.error('[ChunkErrorHandler] Max retries reached. Please check your deployment.');
                    event.preventDefault();
                    return false;
                }

                retryCountRef.current += 1;

                // Get the chunk URL from the error or script tag
                let chunkUrl: string | null = null;
                
                if (target?.tagName === 'SCRIPT') {
                    chunkUrl = (target as HTMLScriptElement).src;
                } else if (error?.message) {
                    const urlMatch = error.message.match(/https?:\/\/[^\s"'<>]+/);
                    chunkUrl = urlMatch?.[0] || null;
                }

                if (chunkUrl) {
                    console.log(`[ChunkErrorHandler] Attempting to reload chunk (attempt ${retryCountRef.current}/${maxRetries}):`, chunkUrl);
                    
                    // Wait a bit before retrying (exponential backoff)
                    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 5000);
                    
                    setTimeout(() => {
                        // Try to reload the chunk by creating a new script tag
                        const script = document.createElement('script');
                        script.src = chunkUrl!;
                        script.async = true;
                        script.crossOrigin = 'anonymous';
                        
                        script.onload = () => {
                            console.log('[ChunkErrorHandler] Chunk reloaded successfully, reloading page');
                            retryCountRef.current = 0; // Reset on success
                            // Reload the page to apply the new chunk
                            window.location.reload();
                        };
                        
                        script.onerror = () => {
                            console.warn(`[ChunkErrorHandler] Failed to reload chunk (attempt ${retryCountRef.current}/${maxRetries})`);
                            if (retryCountRef.current >= maxRetries) {
                                // Final attempt - reload the entire page
                                console.warn('[ChunkErrorHandler] Max retries reached, reloading page');
                                window.location.reload();
                            }
                        };
                        
                        document.head.appendChild(script);
                    }, delay);
                } else {
                    // If we can't extract the URL, just reload the page after a delay
                    console.warn('[ChunkErrorHandler] Chunk URL not found, reloading page');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
                
                // Prevent the error from bubbling up
                event.preventDefault();
                return false;
            }
        };

        // Listen for unhandled errors (capture phase to catch script errors)
        window.addEventListener('error', handleChunkError, true);

        // Also listen for unhandled promise rejections (chunk loading can fail as promises)
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            
            if (
                reason?.name === 'ChunkLoadError' ||
                reason?.message?.includes('Failed to load chunk') ||
                reason?.message?.includes('Loading chunk') ||
                (reason?.message && typeof reason.message === 'string' && reason.message.includes('chunk'))
            ) {
                console.warn('[ChunkErrorHandler] Chunk loading promise rejection:', reason);
                
                if (retryCountRef.current < maxRetries) {
                    retryCountRef.current += 1;
                    event.preventDefault();
                    
                    // Try to reload the page
                    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 5000);
                    setTimeout(() => {
                        window.location.reload();
                    }, delay);
                } else {
                    console.error('[ChunkErrorHandler] Max retries reached for promise rejection');
                }
            }
        };

        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // Cleanup
        return () => {
            window.removeEventListener('error', handleChunkError, true);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    return null;
}
