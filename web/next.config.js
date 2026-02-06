/** @type {import('next').NextConfig} */
const nextConfig = {
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
