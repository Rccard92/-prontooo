import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // packages/db viene pubblicato come sorgente TypeScript, non compilato
  transpilePackages: ['@cassetta/db'],
  // il monorepo sta due livelli sopra: serve a Next per tracciare i file
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  poweredByHeader: false,
}

export default nextConfig
