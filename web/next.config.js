/** @type {import('next').NextConfig} */
const nextConfig = {
    // Production optimizations
    compress: true,
    
    // Ensure static files are generated correctly
    generateEtags: true,
    
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
            // Specific S3 bucket URL (most specific first)
            {
                protocol: "https",
                hostname: "pagz-files.s3.ap-south-1.amazonaws.com",
                pathname: "/**",
            },
            // S3 regional URLs pattern (bucket.s3.region.amazonaws.com)
            {
                protocol: "https",
                hostname: "*.s3.*.amazonaws.com",
                pathname: "/**",
            },
            // Legacy S3 URLs (bucket.s3.amazonaws.com)
            {
                protocol: "https",
                hostname: "*.s3.amazonaws.com",
                pathname: "/**",
            },
            // All AWS S3 domains
            {
                protocol: "https",
                hostname: "*.amazonaws.com",
                pathname: "/**",
            },
            // Unsplash images
            {
                protocol: "https",
                hostname: "images.unsplash.com",
            },
            {
                protocol: "https",
                hostname: "*.unsplash.com",
            },
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
            // T-shirt supplier images
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
        // Increasing the Bandwidth here because we are using the images from the S3 bucket and we want to avoid the image optimization.
        // unoptimized: true,
        loader: "default",
    },
};

export default nextConfig;
