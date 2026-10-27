import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
const buildId = process.env.TIER_BUILD_ID ?? new Date().toISOString();

export default defineConfig({
  base: './',
  plugins: [react(), { name: 'atelier-build-meta', transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'atelier-build', content: buildId }, injectTo: 'head' as const }] }, VitePWA({
    strategies: 'injectManifest', srcDir: 'worker', filename: 'sw.ts', injectRegister: false,
    registerType: 'prompt', scope: './',
    includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
    manifest: {
      id: './', name: 'TIER ATELIER', short_name: 'Tier Atelier', lang: 'ja',
      description: '画像と文字でTier表を作成・保存するツール', start_url: './', scope: './',
      display: 'standalone', background_color: '#f4f5f2', theme_color: '#155d4d',
      icons: [
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      buildPlugins: { vite: [{ name: 'atelier-build-id', config: () => ({ define: { __APP_BUILD_ID__: JSON.stringify(buildId) } }) }] },
    },
    devOptions: { enabled: false },
  })],
  test: { include: ['tests/unit/**/*.test.ts'] },
});
