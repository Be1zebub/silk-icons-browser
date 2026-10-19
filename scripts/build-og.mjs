// Renders scripts/og-template.html into public/og.png.
//
//   node scripts/build-og.mjs
//
// The PNG is committed, so a release build never needs a browser. This script
// only matters when the template changes.
//
// Rasterising needs a headless browser. If neither Playwright nor Puppeteer
// is installed the script says so and leaves the existing PNG alone.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEMPLATE = 'scripts/og-template.html';
const OUTPUT = 'public/og.png';

if (!existsSync(TEMPLATE)) {
	console.error(`missing ${TEMPLATE}`);
	process.exit(1);
}

async function loadBrowser() {
	for (const name of ['playwright', 'puppeteer']) {
		try {
			const module = await import(name);
			return { name, module };
		} catch {
			// Not installed, try the next one.
		}
	}

	return null;
}

const browser = await loadBrowser();

if (!browser) {
	console.log(
		'No headless browser found. Install one of them to regenerate the OG image:\n' +
			'  npm i -D playwright && npx playwright install chromium\n' +
			`Otherwise open ${TEMPLATE} in a browser, screenshot it at 1200x630 and save it to ${OUTPUT}.`,
	);
	process.exit(0);
}

const root = process.cwd();
const url = pathToFileURL(path.resolve(root, TEMPLATE)).href;

if (browser.name === 'playwright') {
	const { chromium } = browser.module;
	const browserInstance = await chromium.launch();
	const page = await browserInstance.newPage({ viewport: { width: 1200, height: 630 } });

	await page.goto(url, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: path.resolve(root, OUTPUT), scale: 'css' });

	await browserInstance.close();
} else {
	const browserInstance = await browser.module.launch();
	const page = await browserInstance.newPage();
	await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
	await page.goto(url, { waitUntil: 'networkidle' });
	await page.screenshot({ path: path.resolve(root, OUTPUT) });
	await browserInstance.close();
}

console.log(`wrote ${OUTPUT}`);
