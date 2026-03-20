/** @type {import('next').NextConfig} */
const nextConfig = {
    // Production optimizations
    compress: true,

    // Hostinger is adding redirects for some paths (notably `/orders`),
    // which can create an `/orders` <-> `/orders/` redirect loop and break RSC payload fetches.
    // Enabling trailingSlash makes Next's canonical URLs match Hostinger's.
    trailingSlash: true,
    
    // Ensure static files are generated correctly
    generateEtags: true,
    
    // Redirects
    async redirects() {
        return [
            {
                source: '/home',
                destination: '/',
                permanent: true,
            },
        ];
    },
    
    // Power optimization for better chunk loading
    poweredByHeader: false,
    
    // Turbopack configuration (Next.js 16+ uses Turbopack by default)
    // Empty config silences the warning, webpack config will still work for production builds
    turbopack: {},
    
    // Improve chunk loading reliability
    // This helps with chunk loading errors in production
    // Note: This webpack config is used for production builds, Turbopack is used for dev
    webpack: (config, { isServer, dev }) => {
        if (!isServer) {
            // Client-side webpack config
            config.optimization = {
                ...config.optimization,
                // Split chunks more aggressively to avoid large chunks
                splitChunks: {
                    chunks: 'all',
                    cacheGroups: {
                        default: false,
                        vendors: false,
                        // Vendor chunks
                        vendor: {
                            name: 'vendor',
                            chunks: 'all',
                            test: /node_modules/,
                            priority: 20,
                        },
                        // Common chunks
                        common: {
                            name: 'common',
                            minChunks: 2,
                            chunks: 'all',
                            priority: 10,
                            reuseExistingChunk: true,
                        },
                    },
                },
            };
            
            // Add error handling for chunk loading
            if (!dev) {
                config.output = {
                    ...config.output,
                    // Ensure chunks are properly named with hashes for cache busting
                    chunkFilename: 'static/chunks/[name].[contenthash].js',
                };
            }
        }
        return config;
    },
    
    // Add onDemandEntries configuration to help with chunk loading
    onDemandEntries: {
        // Period (in ms) where the server will keep pages in the buffer
        maxInactiveAge: 25 * 1000,
        // Number of pages that should be kept simultaneously without being disposed
        pagesBufferLength: 2,
    },
    
    images: {
        // Enable modern image formats for better compression
        formats: ["image/avif", "image/webp"],
        // Image quality settings
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        minimumCacheTTL: 60,
        remotePatterns: [
            // Primary image host — FTP files served from pagz.in
            {
                protocol: "https",
                hostname: "pagz.in",
                pathname: "/**",
            },
            // Development / staging variants
            {
                protocol: "https",
                hostname: "*.pagz.in",
                pathname: "/**",
            },
            // Unsplash images (used in seed data / demos)
            {
                protocol: "https",
                hostname: "images.unsplash.com",
            },
            {
                protocol: "https",
                hostname: "*.unsplash.com",
            },
            // Legacy: keep AWS S3 patterns so old DB records with S3 URLs still render
            {
                protocol: "https",
                hostname: "pagz-files.s3.ap-south-1.amazonaws.com",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "*.s3.*.amazonaws.com",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "*.amazonaws.com",
                pathname: "/**",
            },
            // External image sources (seed/demo data)
            {
                protocol: "https",
                hostname: "www.novaprint.ca",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "*.novaprint.ca",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "www.tshirt-supplier.com",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "*.tshirt-supplier.com",
                pathname: "/**",
            },
        ],
        loader: "default",
    },
};

export default nextConfig;
