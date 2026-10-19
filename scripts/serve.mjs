// Minimal static file server, used to check the production build locally.
//
//   node scripts/serve.mjs [dir] [port]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4321);

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain; charset=utf-8',
};

createServer((request, response) => {
	const url = new URL(request.url ?? '/', 'http://localhost');
	let file = path.join(root, decodeURIComponent(url.pathname));

	if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
	if (!existsSync(file)) {
		response.writeHead(404, { 'content-type': 'text/plain' });
		response.end('not found');
		return;
	}

	response.writeHead(200, {
		'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
	});

	createReadStream(file).pipe(response);
}).listen(port, () => {
	console.log(`serving ${root} on http://localhost:${port}`);
});
