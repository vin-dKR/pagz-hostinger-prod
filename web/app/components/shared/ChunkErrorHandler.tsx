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
        // Also listen for script tag errors directly
        const handleScriptError = (event: Event) => {
            const target = event.target as HTMLScriptElement;
            if (target?.tagName === 'SCRIPT' && target.src) {
                const src = target.src;
                if (src.includes('_next/static/chunks') || src.includes('_next/static')) {
                    console.warn('[ChunkErrorHandler] Script loading error detected:', src);
                    
                    if (retryCountRef.current >= maxRetries) {
                        console.error('[ChunkErrorHandler] Max retries reached for script error');
                        return;
                    }
                    
                    retryCountRef.current += 1;
                    
                    // Wait before retrying
                    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 5000);
                    
                    setTimeout(() => {
                        // Clear service worker cache if present
                        if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.getRegistrations().then(registrations => {
                                registrations.forEach(registration => registration.unregister());
                            });
                        }
                        // Force reload with cache bypass
                        window.location.href = window.location.href.split('?')[0] + '?_cb=' + Date.now();
                    }, delay);
                }
            }
        };
        
        // Handle chunk loading errors
        const handleChunkError = (event: ErrorEvent) => {
            const error = event.error;
            const target = event.target as HTMLElement;
            
            // Check if it's a chunk loading error
            const errorMessage = error?.message || '';
            const errorName = error?.name || '';
            const scriptSrc = (target as HTMLScriptElement)?.src || target?.getAttribute('src') || '';
            
            const isChunkError = 
                errorName === 'ChunkLoadError' ||
                errorMessage.includes('Failed to load chunk') ||
                errorMessage.includes('Loading chunk') ||
                errorMessage.includes('Loading failed for the <script>') ||
                errorMessage.includes('ChunkLoadError') ||
                (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('chunk')) ||
                (target?.tagName === 'SCRIPT' && scriptSrc.includes('_next/static/chunks')) ||
                (target?.tagName === 'SCRIPT' && scriptSrc.includes('_next/static'));

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
                        // Add cache-busting parameter to force fresh load
                        const cacheBuster = `?v=${Date.now()}`;
                        const urlWithCacheBust = chunkUrl.includes('?') 
                            ? `${chunkUrl}&_cb=${Date.now()}` 
                            : `${chunkUrl}${cacheBuster}`;
                        
                        // Try to reload the chunk by creating a new script tag
                        const script = document.createElement('script');
                        script.src = urlWithCacheBust;
                        script.async = true;
                        script.crossOrigin = 'anonymous';
                        script.integrity = ''; // Clear integrity if present
                        
                        script.onload = () => {
                            console.log('[ChunkErrorHandler] Chunk reloaded successfully, reloading page');
                            retryCountRef.current = 0; // Reset on success
                            // Reload the page to apply the new chunk
                            setTimeout(() => {
                                window.location.reload();
                            }, 100);
                        };
                        
                        script.onerror = () => {
                            console.warn(`[ChunkErrorHandler] Failed to reload chunk (attempt ${retryCountRef.current}/${maxRetries})`);
                            if (retryCountRef.current >= maxRetries) {
                                // Final attempt - reload the entire page with cache bust
                                console.warn('[ChunkErrorHandler] Max retries reached, reloading page with cache clear');
                                // Clear service worker cache if present
                                if ('serviceWorker' in navigator) {
                                    navigator.serviceWorker.getRegistrations().then(registrations => {
                                        registrations.forEach(registration => registration.unregister());
                                    });
                                }
                                // Force reload with cache bypass
                                window.location.href = window.location.href.split('?')[0] + '?_cb=' + Date.now();
                            }
                        };
                        
                        document.head.appendChild(script);
                    }, delay);
                } else {
                    // If we can't extract the URL, just reload the page after a delay with cache bust
                    console.warn('[ChunkErrorHandler] Chunk URL not found, reloading page with cache clear');
                    setTimeout(() => {
                        // Clear service worker cache if present
                        if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.getRegistrations().then(registrations => {
                                registrations.forEach(registration => registration.unregister());
                            });
                        }
                        // Force reload with cache bypass
                        window.location.href = window.location.href.split('?')[0] + '?_cb=' + Date.now();
                    }, 1000);
                }
                
                // Prevent the error from bubbling up
                event.preventDefault();
                return false;
            }
        };

        // Listen for script errors
        document.addEventListener('error', handleScriptError, true);
        
        // Listen for unhandled errors (capture phase to catch script errors)
        window.addEventListener('error', handleChunkError, true);

        // Also listen for unhandled promise rejections (chunk loading can fail as promises)
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            
            const reasonMessage = reason?.message || '';
            const reasonName = reason?.name || '';
            
            if (
                reasonName === 'ChunkLoadError' ||
                reasonMessage.includes('Failed to load chunk') ||
                reasonMessage.includes('Loading chunk') ||
                reasonMessage.includes('Loading failed for the <script>') ||
                reasonMessage.includes('ChunkLoadError') ||
                (typeof reasonMessage === 'string' && reasonMessage.toLowerCase().includes('chunk'))
            ) {
                console.warn('[ChunkErrorHandler] Chunk loading promise rejection:', reason);
                
                if (retryCountRef.current < maxRetries) {
                    retryCountRef.current += 1;
                    event.preventDefault();
                    
                    // Try to reload the page with cache bust
                    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 5000);
                    setTimeout(() => {
                        // Clear service worker cache if present
                        if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.getRegistrations().then(registrations => {
                                registrations.forEach(registration => registration.unregister());
                            });
                        }
                        // Force reload with cache bypass
                        window.location.href = window.location.href.split('?')[0] + '?_cb=' + Date.now();
                    }, delay);
                } else {
                    console.error('[ChunkErrorHandler] Max retries reached for promise rejection');
                    // Final attempt - clear cache and reload
                    if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.getRegistrations().then(registrations => {
                            registrations.forEach(registration => registration.unregister());
                            window.location.href = window.location.href.split('?')[0] + '?_cb=' + Date.now();
                        });
                    } else {
                        window.location.href = window.location.href.split('?')[0] + '?_cb=' + Date.now();
                    }
                }
            }
        };

        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // Cleanup
        return () => {
            document.removeEventListener('error', handleScriptError, true);
            window.removeEventListener('error', handleChunkError, true);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    return null;
}
