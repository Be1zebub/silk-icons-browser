// Renders scripts/og-template.html into public/og.png.
//
//   npm run build:og
//
// The PNG is committed, so a release build never needs a browser. This script
// only matters when the template changes.
//
// Rasterising needs the Playwright chromium build:
//
//   npx playwright install chromium
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEMPLATE = 'scripts/og-template.html';
const OUTPUT = 'public/og.png';

if (!existsSync(TEMPLATE)) {
	console.error(`missing ${TEMPLATE}`);
	process.exit(1);
}

const root = process.cwd();
const url = pathToFileURL(path.resolve(root, TEMPLATE)).href;

let chromium;
try {
	({ chromium } = await import('playwright'));
} catch {
	console.error(
		'playwright is not installed. Run:\n' +
			'  npm i -D playwright && npx playwright install chromium',
	);
	process.exit(1);
}

let browser;
try {
	browser = await chromium.launch();
} catch (error) {
	console.error(
		'Could not start chromium. The browser binary is probably missing, run:\n' +
			'  npx playwright install chromium\n' +
			`(${error instanceof Error ? error.message : String(error)})`,
	);
	process.exit(1);
}

const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.resolve(root, OUTPUT), scale: 'css' });

await browser.close();

console.log(`wrote ${OUTPUT}`);
