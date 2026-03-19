/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Primary image host — FTP files served from pagz.in
      {
        protocol: 'https',
        hostname: 'pagz.in',
        pathname: '/**',
      },
      // Development / staging variants
      {
        protocol: 'https',
        hostname: '*.pagz.in',
        pathname: '/**',
      },
      // Unsplash (seed / demo data)
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
      // Legacy: keep AWS S3 patterns so old DB records with S3 URLs still render
      {
        protocol: 'https',
        hostname: 'pagz-files.s3.ap-south-1.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        pathname: '/**',
      },
      // Allow all other HTTPS domains as final fallback (external demo images)
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;

