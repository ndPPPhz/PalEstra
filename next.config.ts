import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Self-hosted on Arch + systemd: `standalone` emits .next/standalone/server.js
  // with only the needed node_modules, so the unit file runs a single process
  // and deploy.sh doesn't need dev dependencies on the server.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
