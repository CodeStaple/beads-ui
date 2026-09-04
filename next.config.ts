import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone with a self-contained server — keeps the runtime
  // image small and avoids shipping node_modules.
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;
