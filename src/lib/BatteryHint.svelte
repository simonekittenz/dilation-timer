<script lang="ts">
	import { onMount } from 'svelte';
	import {
		batteryAdvice,
		batteryHintDismissed,
		dismissBatteryHint,
		getDeviceInfo,
		makerGroup,
		shouldShowBatteryHint,
		type DeviceInfo
	} from './deviceHelp';

	let info = $state<DeviceInfo | null>(null);
	let dismissed = $state(batteryHintDismissed());
	const show = $derived(shouldShowBatteryHint(info, dismissed));
	const who = $derived(batteryAdvice(makerGroup(info?.manufacturer ?? '')).who);

	onMount(async () => {
		info = await getDeviceInfo();
	});

	function gotIt() {
		dismissBatteryHint();
		dismissed = true;
	}
</script>

{#if show}
	<aside class="card hint" data-testid="battery-hint" aria-label="Battery and alerts">
		<p>
			<strong>Heads up ♡</strong> On {who}, alerts can get lost while your phone is locked, unless
			its battery limits are off for this app.
		</p>
		<div class="buttons">
			<a class="btn small" href="/settings/alerts#battery">Show me how</a>
			<button class="btn ghost small" onclick={gotIt}>Got it</button>
		</div>
	</aside>
{/if}

<style>
	.hint {
		display: grid;
		gap: 0.6rem;
		margin-top: 1rem;
		font-size: 0.92rem;
		line-height: 1.45;
		background: color-mix(in srgb, var(--accent-soft) 40%, var(--surface));
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
