<script lang="ts">
	let { color, size = 22 }: { color: string; size?: number } = $props();
</script>

<span
	class="swatch"
	style:--c={color}
	style:width="{size * 0.62}px"
	style:height="{size}px"
	aria-hidden="true"
></span>

<style>
	.swatch {
		display: inline-block;
		flex: none;
		vertical-align: middle;
		border-radius: 999px / 38%;
		background: linear-gradient(100deg, rgba(255, 255, 255, 0.55) 0 22%, transparent 45%), var(--c);
		box-shadow:
			inset 0 0 0 1.5px rgba(90, 40, 80, 0.22),
			0 1px 2px rgba(90, 40, 80, 0.2);
	}
</style>
