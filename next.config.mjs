import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  /* pin the workspace root — a stray package-lock.json in the home dir was
     making Next resolve .next one directory too high */
  outputFileTracingRoot: path.resolve(process.cwd()),
  /* the MCP Apps sandbox page is read from disk by its route */
  outputFileTracingIncludes: {
    '/mcp-sandbox': ['./lib/mcp-app/sandbox.html'],
    '/api/studio-agent': ['./lib/studio-kb/*.md'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
