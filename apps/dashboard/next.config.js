/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@ledgermail/shared",
    "@ledgermail/database",
    "@ledgermail/core",
    "@ledgermail/providers"
  ]
};

module.exports = nextConfig;
