/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite abrir el servidor de desarrollo desde la IP local expuesta por la VM.
  // No cambia el comportamiento de la aplicación en producción.
  allowedDevOrigins: ["192.168.56.1"],
};

module.exports = nextConfig;
