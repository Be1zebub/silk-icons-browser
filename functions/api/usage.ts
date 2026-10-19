/**
 * Cloudflare Pages Function: the global copy counter.
 *
 *   POST /api/usage   { counts: { icon: number, ... } }  -> 204
 *   GET  /api/usage                                       -> { counts: {...} }
 *
 * Storage is a KV namespace bound as `USAGE`. The binding is optional: without
 * it the function answers 204 and drops the data, so a deploy that has not
 * set the binding up yet still works.
 *
 * The client batches its copies and posts the delta every few seconds, so a
 * visitor costs one KV write per batch rather than one per copy.
 */

interface KvNamespace {
	get(key: string, type: "text"): Promise<string | null>
	put(key: string, value: string): Promise<void>
}

interface Env {
	USAGE?: KvNamespace
}

type PagesFunction<Env> = (context: {
	request: Request
	env: Env
}) => Promise<Response>

const KEY = "usage:counts"
/** Keep the value small: KV values are limited and the tail is noise anyway. */
const MAX_ICONS = 512

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store",
			"access-control-allow-origin": "*",
		},
	})

const readCounts = async (env: Env): Promise<Record<string, number>> => {
	if (!env.USAGE) return {}

	const raw = await env.USAGE.get(KEY, "text")
	if (!raw) return {}

	try {
		const parsed: unknown = JSON.parse(raw)
		if (typeof parsed !== "object" || parsed === null) return {}

		const counts: Record<string, number> = {}
		for (const [icon, count] of Object.entries(parsed as Record<string, unknown>)) {
			if (typeof count === "number" && Number.isFinite(count) && count > 0) {
				counts[icon] = Math.floor(count)
			}
		}

		return counts
	} catch {
		return {}
	}
}

export const onRequestOptions: PagesFunction<Env> = async () =>
	new Response(null, {
		status: 204,
		headers: {
			"access-control-allow-origin": "*",
			"access-control-allow-methods": "GET, POST, OPTIONS",
			"access-control-allow-headers": "content-type",
			"access-control-max-age": "86400",
		},
	})

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	let incoming: unknown
	try {
		incoming = await request.json()
	} catch {
		return json({ error: "invalid json" }, 400)
	}

	const delta = (incoming as { counts?: unknown })?.counts
	if (typeof delta !== "object" || delta === null) {
		return json({ error: "counts is required" }, 400)
	}

	if (!env.USAGE) return new Response(null, { status: 204 })

	const counts = await readCounts(env)

	for (const [icon, value] of Object.entries(delta as Record<string, unknown>)) {
		if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue
		if (!/^[a-z0-9_]{1,64}$/.test(icon)) continue

		counts[icon] = (counts[icon] ?? 0) + Math.floor(value)
	}

	// Drop the coldest entries when the map grows too large.
	const names = Object.keys(counts)
	if (names.length > MAX_ICONS) {
		for (const name of names
			.sort((left, right) => (counts[left] ?? 0) - (counts[right] ?? 0))
			.slice(0, names.length - MAX_ICONS)) {
			delete counts[name]
		}
	}

	await env.USAGE.put(KEY, JSON.stringify(counts))

	return new Response(null, { status: 204 })
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
	if (!env.USAGE) return json({ counts: {} })

	return json({ counts: await readCounts(env) })
}
