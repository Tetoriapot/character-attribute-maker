import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Two complete production releases exercise the real browser update lifecycle.
for (const release of ['a', 'b']) {
  execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', `.qa/pwa-${release}`], {
    stdio: 'inherit', env: { ...process.env, TIER_BUILD_ID: `pwa-${release}` },
  });
}
execFileSync(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.pwa.config.ts', ...process.argv.slice(2)], { stdio: 'inherit' });
