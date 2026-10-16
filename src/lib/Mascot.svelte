<script lang="ts">
	import { store } from './store.svelte';
	import type { MascotKind } from './types';

	type Mood = 'happy' | 'alert' | 'done';
	// `animal` is only passed by the Settings picker; everywhere else follows your choice.
	let {
		mood = 'happy',
		size = 96,
		animal
	}: { mood?: Mood; size?: number; animal?: MascotKind } = $props();
	const kind = $derived(animal ?? store.settings.mascot);
</script>

<svg
	class="mascot {kind} {mood}"
	width={size}
	height={size}
	viewBox="0 0 120 120"
	role="img"
	aria-label={kind === 'kitty' ? 'Kitty' : 'Bunny'}
>
	<g class="ears">
		{#if kind === 'kitty'}
			<path class="ear l" d="M22 64 L26 18 L64 48 Z" />
			<path class="inner l" d="M30 54 L31 31 L50 47 Z" />
			<path class="ear r" d="M98 64 L94 18 L56 48 Z" />
			<path class="inner r" d="M90 54 L89 31 L70 47 Z" />
		{:else}
			<ellipse class="ear l" cx="40" cy="34" rx="13" ry="30" />
			<ellipse class="inner l" cx="40" cy="36" rx="6.5" ry="20" />
			<ellipse class="ear r" cx="80" cy="34" rx="13" ry="30" />
			<ellipse class="inner r" cx="80" cy="36" rx="6.5" ry="20" />
		{/if}
	</g>
	<ellipse class="head" cx="60" cy="80" rx="42" ry="33" />
	{#if kind === 'kitty'}
		<path class="whiskers" d="M6 79 L31 83 M8 92 L31 89 M114 79 L89 83 M112 92 L89 89" />
	{/if}
	<ellipse class="blush" cx="35" cy="90" rx="8" ry="5" />
	<ellipse class="blush" cx="85" cy="90" rx="8" ry="5" />
	{#if mood === 'happy'}
		<path class="eye-line" d="M41 80 q5 -7 10 0 M69 80 q5 -7 10 0" />
	{:else if mood === 'alert'}
		<circle class="eye" cx="46" cy="80" r="5" />
		<circle class="eye" cx="74" cy="80" r="5" />
		<circle class="shine" cx="48" cy="78" r="1.8" />
		<circle class="shine" cx="76" cy="78" r="1.8" />
	{:else}
		<text class="star" x="46" y="86" text-anchor="middle">★</text>
		<text class="star" x="74" y="86" text-anchor="middle">★</text>
	{/if}
	{#if kind === 'kitty'}
		<path class="nose-tri" d="M56 87.5 L64 87.5 L60 92.5 Z" />
	{:else}
		<ellipse class="nose" cx="60" cy="90" rx="3.5" ry="2.6" />
	{/if}
	<path class="mouth" d="M60 93 q-5 7 -10 2 M60 93 q5 7 10 2" />
</svg>

<style>
	.mascot {
		display: block;
		overflow: visible;
	}
	.ear,
	.head {
		fill: var(--bunny);
		stroke: var(--bunny-line);
		stroke-width: 2.5;
		stroke-linejoin: round;
	}
	.whiskers {
		fill: none;
		stroke: var(--bunny-line);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.nose-tri {
		fill: #ff7eb6;
		stroke: #ff7eb6;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.inner {
		fill: #ffb6d3;
		stroke: #ffb6d3;
		stroke-width: 1;
		stroke-linejoin: round;
	}
	.blush {
		fill: #ff9fc6;
		opacity: 0.55;
	}
	.eye {
		fill: #5b2a47;
	}
	.shine {
		fill: #fff;
	}
	.eye-line,
	.mouth {
		fill: none;
		stroke: #5b2a47;
		stroke-width: 3;
		stroke-linecap: round;
	}
	.mouth {
		stroke-width: 2.4;
	}
	.nose {
		fill: #ff7eb6;
	}
	.star {
		fill: #ff4f9a;
		font-size: 20px;
	}
	.ears {
		transform-origin: 60px 70px;
		animation: sway 4s ease-in-out infinite;
	}
	.alert .ears {
		animation: wiggle 0.5s ease-in-out infinite;
	}
	.done {
		animation: hop 1.2s ease-in-out infinite;
	}
	@keyframes sway {
		50% {
			transform: rotate(3deg);
		}
	}
	@keyframes wiggle {
		50% {
			transform: rotate(-6deg);
		}
		0%,
		100% {
			transform: rotate(6deg);
		}
	}
	@keyframes hop {
		50% {
			transform: translateY(-8px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ears,
		.done {
			animation: none;
		}
	}
</style>
