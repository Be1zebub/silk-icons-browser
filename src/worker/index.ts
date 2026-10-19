/**
 * The Worker: the static site plus the copy counter.
 *
 * The assets are uploaded with the Worker, so there is one deployment and one
 * origin. `public/_headers` still applies, it is read from the assets
 * directory.
 */
import { Counters } from "./counters"

export { Counters }

interface Fetcher {
	fetch(request: Request): Promise<Response>
}

interface DurableObjectNamespace {
	idFromName(name: string): { toString(): string }
	get(id: { toString(): string }): { fetch(request: Request): Promise<Response> }
}

interface Env {
	ASSETS: Fetcher
	COUNTERS: DurableObjectNamespace
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url)

		if (url.pathname === "/api/usage") {
			const id = env.COUNTERS.idFromName("global")
			return env.COUNTERS.get(id).fetch(request)
		}

		const response = await env.ASSETS.fetch(request)
		if (response.status !== 404) return response

		// Single page app: unknown paths still get the app.
		return env.ASSETS.fetch(new Request(new URL("/index.html", url), request))
	},
}
