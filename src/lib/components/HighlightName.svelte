<script lang="ts">
	import type { Range } from "../core/types"

	interface Props {
		text: string
		ranges: readonly Range[]
	}

	let { text, ranges }: Props = $props()

	type Piece = { text: string; match: boolean }

	const pieces = $derived.by<Piece[]>(() => {
		if (ranges.length === 0) return [{ text, match: false }]

		const result: Piece[] = []
		let cursor = 0

		for (const [start, end] of ranges) {
			if (start > cursor)
				result.push({ text: text.slice(cursor, start), match: false })
			result.push({ text: text.slice(start, end), match: true })
			cursor = end
		}

		if (cursor < text.length)
			result.push({ text: text.slice(cursor), match: false })

		return result
	})

	interface Segment {
		key: string
		text: string
		match: boolean
		/** True when an underscore follows this chunk. */
		underscore: boolean
	}

	/**
	 * Icon names are snake_case, so every underscore is a legal wrap point.
	 * The chunks are keyed by a running counter: two pieces can split into the
	 * same local index, so the key has to be unique across the whole list.
	 */
	const segments = $derived.by<Segment[]>(() => {
		const result: Segment[] = []
		let counter = 0

		for (const piece of pieces) {
			const parts = piece.text.split("_")

			parts.forEach((part, index) => {
				result.push({
					key: String(counter++),
					text: part,
					match: piece.match,
					underscore: index < parts.length - 1,
				})
			})
		}

		return result
	})
</script>

{#each segments as segment (segment.key)}{#if segment.match}<mark
			>{segment.text}</mark
		>{:else}{segment.text}{/if}{#if segment.underscore}_<wbr />{/if}{/each}

<style>
	mark {
		margin: 0 -1px;
		padding: 0 1px;
		border-radius: 2px;
		background-color: color-mix(in oklab, var(--primary) 32%, transparent);
		color: var(--foreground);
	}
</style>
