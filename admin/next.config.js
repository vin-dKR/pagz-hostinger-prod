/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Specific S3 bucket URL - MUST be first for exact match
      {
        protocol: 'https',
        hostname: 'pagz-files.s3.ap-south-1.amazonaws.com',
        pathname: '/**',
      },
      // Generic AWS S3 pattern (matches bucket.s3.amazonaws.com)
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
        pathname: '/**',
      },
      // All AWS domains as fallback
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        pathname: '/**',
      },
      // Unsplash images
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.unsplash.com',
      },
      // Localhost for development
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      // Allow all other HTTPS domains as final fallback
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Configuration options
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;

