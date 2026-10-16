<div class="ears" aria-hidden="true">
	<svg viewBox="0 0 220 170" width="100%">
		<g class="pair">
			<g class="ear l">
				<ellipse class="outer" cx="68" cy="95" rx="30" ry="72" />
				<ellipse class="inner" cx="68" cy="100" rx="15" ry="52" />
			</g>
			<g class="ear r">
				<ellipse class="outer" cx="152" cy="95" rx="30" ry="72" />
				<ellipse class="inner" cx="152" cy="100" rx="15" ry="52" />
			</g>
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
	}
	.inner {
		fill: #ffb6d3;
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
