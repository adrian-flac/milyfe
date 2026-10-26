/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    // Next requires inline bootstrap scripts/styles unless the app is converted
    // to a nonce-based CSP. External scripts, frames, and form submissions stay
    // restricted to this origin.
    value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; manifest-src 'self'; media-src 'self'; worker-src 'self' blob:",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const apiNoStoreHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
  { key: "Pragma", value: "no-cache" },
];

const nextConfig = {
  poweredByHeader: false,
  // Solo se necesita para el servidor de desarrollo expuesto por la VM.
  ...(isProduction ? {} : { allowedDevOrigins: ["192.168.56.1"] }),
  async headers() {
    return [
      ...(isProduction ? [{ source: "/:path*", headers: securityHeaders }] : []),
      // La información personal nunca debe reutilizarse desde una caché compartida.
      { source: "/api/:path*", headers: apiNoStoreHeaders },
    ];
  },
};

module.exports = nextConfig;
