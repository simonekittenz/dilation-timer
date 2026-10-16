<script lang="ts">
	type Mood = 'happy' | 'alert' | 'done';
	let { mood = 'happy', size = 96 }: { mood?: Mood; size?: number } = $props();
</script>

<svg
	class="bunny {mood}"
	width={size}
	height={size}
	viewBox="0 0 120 120"
	role="img"
	aria-label="Bunny"
>
	<g class="ears">
		<ellipse class="ear l" cx="40" cy="34" rx="13" ry="30" />
		<ellipse class="inner l" cx="40" cy="36" rx="6.5" ry="20" />
		<ellipse class="ear r" cx="80" cy="34" rx="13" ry="30" />
		<ellipse class="inner r" cx="80" cy="36" rx="6.5" ry="20" />
	</g>
	<ellipse class="head" cx="60" cy="80" rx="42" ry="33" />
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
	<ellipse class="nose" cx="60" cy="90" rx="3.5" ry="2.6" />
	<path class="mouth" d="M60 93 q-5 7 -10 2 M60 93 q5 7 10 2" />
</svg>

<style>
	.bunny {
		display: block;
		overflow: visible;
	}
	.ear,
	.head {
		fill: var(--bunny);
		stroke: var(--bunny-line);
		stroke-width: 2.5;
	}
	.inner {
		fill: #ffb6d3;
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
