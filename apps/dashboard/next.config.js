/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@ledgermail/shared",
    "@ledgermail/database",
    "@ledgermail/core",
    "@ledgermail/providers"
  ],
  // Browser talks same-origin; Next proxies to LedgerMail API (avoids Failed to fetch / CORS).
  async rewrites() {
    const api = process.env.LEDGERMAIL_API_ORIGIN || "http://127.0.0.1:3002";
    return [
      {
        source: "/ledger-api/:path*",
        destination: `${api.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
