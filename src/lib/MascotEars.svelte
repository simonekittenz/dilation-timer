<script lang="ts">
	import { store } from './store.svelte';

	// A short, wide ear with a softly pointed tip. The right one is this same shape, mirrored.
	const KITTY_EAR = 'M24 172 L54 76 Q64 52 76 74 L112 172 Z';
	const KITTY_EAR_INNER = 'M48 170 L62 102 Q66 88 72 100 L92 170 Z';
</script>

<div class="ears" aria-hidden="true">
	<svg viewBox="0 0 220 170" width="100%">
		<g class="pair">
			{#if store.settings.mascot === 'kitty'}
				<g class="ear l">
					<path class="outer" d={KITTY_EAR} />
					<path class="inner" d={KITTY_EAR_INNER} />
				</g>
				<g class="ear r">
					<g transform="translate(220 0) scale(-1 1)">
						<path class="outer" d={KITTY_EAR} />
						<path class="inner" d={KITTY_EAR_INNER} />
					</g>
				</g>
			{:else}
				<g class="ear l">
					<ellipse class="outer" cx="68" cy="95" rx="30" ry="72" />
					<ellipse class="inner" cx="68" cy="100" rx="15" ry="52" />
				</g>
				<g class="ear r">
					<ellipse class="outer" cx="152" cy="95" rx="30" ry="72" />
					<ellipse class="inner" cx="152" cy="100" rx="15" ry="52" />
				</g>
			{/if}
		</g>
	</svg>
</div>

<style>
	.ears {
		position: fixed;
		z-index: 100;
		left: 50%;
		bottom: 0;
		width: min(240px, 62vw);
		pointer-events: none;
		transform: translate(-50%, 105%);
		animation: peek 3.4s ease-in-out forwards;
	}
	.outer {
		fill: var(--bunny);
		stroke: var(--bunny-line);
		stroke-width: 4;
		stroke-linejoin: round;
	}
	.inner {
		fill: #ffb6d3;
		stroke: #ffb6d3;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.ear {
		transform-origin: 50% 100%;
		transform-box: fill-box;
		animation: wiggle 0.5s ease-in-out 0.45s 5;
	}
	.ear.r {
		animation-direction: reverse;
	}
	@keyframes peek {
		0% {
			transform: translate(-50%, 105%);
		}
		12%,
		86% {
			transform: translate(-50%, 8%);
		}
		100% {
			transform: translate(-50%, 105%);
		}
	}
	@keyframes wiggle {
		0%,
		100% {
			transform: rotate(-7deg);
		}
		50% {
			transform: rotate(7deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ears {
			animation: fade 3.4s ease-in-out forwards;
			transform: translate(-50%, 8%);
			opacity: 0;
		}
		.ear {
			animation: none;
		}
		@keyframes fade {
			12%,
			86% {
				opacity: 1;
			}
		}
	}
</style>
