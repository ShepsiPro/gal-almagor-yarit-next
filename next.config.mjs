/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async redirects() {
    return [
      // One address for the site: www goes to the apex, which is the canonical
      // host in every page's metadata and in the sitemap.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.almagor-yaarit.com" }],
        destination: "https://almagor-yaarit.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
