import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'books.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'books.google.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      // Explicitly allow the Codespaces URL for Server Actions in development
      // This bypasses the strict origin/x-forwarded-host check for this specific domain.
      // Add other development URLs here if needed (e.g., other Codespaces names, local IP).
      allowedOrigins: [
        'https://crispy-computing-machine-r5r59p5564pcwqp4-9002.app.github.dev',
      ],
    },
  },
};

export default nextConfig;
