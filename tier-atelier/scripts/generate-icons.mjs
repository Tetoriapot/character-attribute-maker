import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

// Render the existing vector mark. No network or user images are used.
const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [name, size, maskable] of [['pwa-192.png', 192, false], ['pwa-512.png', 512, false], ['apple-touch-icon.png', 180, true], ['pwa-maskable-512.png', 512, true]]) {
    const data = await page.evaluate(async ({ svg, size, maskable }) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      context.fillStyle = '#155d4d'; context.fillRect(0, 0, size, size);
      const img = new Image(); img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await img.decode();
      const inset = maskable ? size * .12 : 0;
      context.drawImage(img, inset, inset, size - inset * 2, size - inset * 2);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { svg, size, maskable });
    await writeFile(new URL(`../public/${name}`, import.meta.url), Buffer.from(data, 'base64'));
  }
} finally { await browser.close(); }
