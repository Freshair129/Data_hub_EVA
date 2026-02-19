/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable static export for simple deployment
    // output: 'export',

    // Allow images from external sources
    images: {
        unoptimized: true,
    },
    experimental: {
        serverComponentsExternalPackages: ['pg', '@prisma/adapter-pg'],
    },

    // Trailing slash for static hosting compatibility
    // trailingSlash: true,
};

module.exports = nextConfig;
