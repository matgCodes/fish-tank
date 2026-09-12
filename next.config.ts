import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compression buffers server-sent events.
  compress: false,
  // The door sign phone and room display load the dev server by LAN address.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
};

export default nextConfig;
