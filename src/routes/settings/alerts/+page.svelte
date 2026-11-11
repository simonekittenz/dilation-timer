<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { previewSound, setVolume, testSound } from '#lib/alarm.ts';
	import {
		batteryAdvice,
		getDeviceInfo,
		makerGroup,
		openAppSettings,
		type DeviceInfo
	} from '#lib/deviceHelp.ts';
	import { isNative, nativePlatform } from '#lib/platform.ts';
	import ReminderTimes from '#lib/ReminderTimes.svelte';
	import { describeSwitch, type SmartRow } from '#lib/switchHistory.ts';
	import { defaultReminders, slotsInSchedule } from '#lib/reminders.ts';
	import { store } from '#lib/store.svelte.ts';
	import type { Reminders } from '#lib/types.ts';
	import { useSettingsForm } from '#lib/settingsForm.svelte.ts';

	// Android: is the phone limiting this app's battery use? (Looked at again when you come back from the settings.)
	let device = $state<DeviceInfo | null>(null);
	const advice = $derived(batteryAdvice(makerGroup(device?.manufacturer ?? '')));
	async function checkDevice(scrollToIt = false) {
		device = await getDeviceInfo();
		// arriving from the note on Today: go straight to this part (only the first time)
		await tick();
		if (scrollToIt && location.hash === '#battery') {
			document.getElementById('battery')?.scrollIntoView();
		}
	}
	onMount(() => {
		void checkDevice(true);
		const again = () => document.visibilityState === 'visible' && void checkDevice();
		document.addEventListener('visibilitychange', again);
		return () => document.removeEventListener('visibilitychange', again);
	});

	// Smart timer: what is typed for each dilator's own value (minutes), until it is used
	let typed = $state<Record<string, string>>({});
	const minutesOf = (ms: number) => String(Math.round((ms / 60000) * 10) / 10);
	const shownMinutes = (row: SmartRow) =>
		typed[row.label] ?? (row.usualMs !== null ? minutesOf(row.usualMs) : '');
	const day = (ms: number) =>
		new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	function useMyValue(row: SmartRow) {
		const minutes = Number(String(shownMinutes(row)).replace(',', '.'));
		if (!Number.isFinite(minutes) || minutes <= 0) return;
		draft.swapOverrides = {
			...(draft.swapOverrides ?? {}),
			[row.label]: { ms: Math.round(minutes * 60000), since: Date.now() }
		};
		delete typed[row.label];
	}
	function backToLearning(row: SmartRow) {
		const next = { ...(draft.swapOverrides ?? {}) };
		delete next[row.label];
		draft.swapOverrides = next;
		delete typed[row.label];
	}

	const form = useSettingsForm();
	const draft = form.draft;

	const reminders = $derived(draft.reminders ?? { ...defaultReminders(), enabled: false });
	const reminderSlots = $derived(slotsInSchedule(draft));
	/** Changes made here also go to the store right away, so the phone's reminders follow. */
	function changeReminders(next: Reminders) {
		draft.reminders = next;
		void store.setReminders($state.snapshot(next));
	}

	const settingsVolumeOff = $derived(Number(draft.volume) === 0);
	let alertNote = $state('');
	async function testAlert() {
		const sent = await store.testLockedScreenAlert();
		alertNote = sent
			? 'Test alert on its way. Lock your phone now ♡'
			: "Couldn't schedule it. Check that notifications are allowed for this app.";
	}
</script>

<div class="panel">
	<label class="item">
		<span class="text">
			<span class="label">Gentle switch window</span>
			<span class="hint">
				Minutes of quiet time to swap to the next dilator before the alarm starts blinking and
				beeping. If you usually take longer to swap to that dilator, I wait that long instead
			</span>
		</span>
		<input type="number" min="0" step="0.5" class="num" bind:value={draft.switchWindowMinutes} />
	</label>
	<label class="item">
		<span class="text">
			<span class="label">Extra time for a new dilator</span>
			<span class="hint">
				The first time you use a dilator I wait this many extra minutes before nudging, because it
				usually takes a little longer
			</span>
		</span>
		<input type="number" min="0" step="0.5" class="num" bind:value={draft.newDilatorExtraMinutes} />
	</label>
	<label class="item">
		<span class="text">
			<span class="label">Start screen</span>
			<span class="hint">
				When you start a session, show which dilator to bring in first, and begin the first timer
				when you press Go. Off starts the first timer straight away
			</span>
		</span>
		<input
			type="checkbox"
			class="toggle"
			checked={draft.startScreen !== false}
			onchange={(e) => (draft.startScreen = e.currentTarget.checked)}
			aria-label="Start screen"
		/>
	</label>
	{#if draft.startScreen !== false}
		<label class="item">
			<span class="text">
				<span class="label">Clock on the start screen</span>
				<span class="hint">
					When you start a session, show a clock counting how long you take to get ready, with Pause
					and Reset. Off keeps that screen simple; the time is still noted
				</span>
			</span>
			<input
				type="checkbox"
				class="toggle"
				checked={draft.showStartTimer !== false}
				onchange={(e) => (draft.showStartTimer = e.currentTarget.checked)}
				aria-label="Clock on the start screen"
			/>
		</label>
	{/if}
	{#if isNative()}
		<label class="item">
			<span class="text">
				<span class="label">Timer on the lock screen</span>
				<span class="hint">
					{#if nativePlatform() === 'ios'}
						While a session runs, keep its timer on your lock screen and in the Dynamic Island
					{:else}
						While a session runs and you've left the app or locked your phone, keep its timer where
						you can see it. On Android 16 it also shows as a chip at the top
					{/if}
				</span>
			</span>
			<input
				type="checkbox"
				class="toggle"
				checked={draft.lockScreenTimer !== false}
				onchange={(e) => (draft.lockScreenTimer = e.currentTarget.checked)}
				aria-label="Timer on the lock screen"
			/>
		</label>
	{/if}
	<div class="block" data-testid="smart-timer">
		<div class="item-head">
			<span class="label">Smart timer</span>
			<input
				type="checkbox"
				class="toggle"
				checked={draft.smartTimer !== false}
				onchange={(e) => (draft.smartTimer = e.currentTarget.checked)}
				aria-label="Smart timer"
			/>
		</div>
		{#if draft.smartTimer === false}
			<p class="hint">
				Off. I nudge you after the gentle switch window above, for every dilator, whatever your
				swaps have been like.
			</p>
		{:else}
			<p class="hint">
				I time how long you take to swap to each dilator, and nudge you when that time is up, never
				sooner than the window above. Swaps where you only pressed the button after the nudge,
				without asking for more time, don't count: that's most likely forgetting. The first swap to
				a dilator doesn't count either, since that one is slow on purpose.
			</p>
			<ul class="smart">
				{#each store.smartTimerRows as row (row.label)}
					<li data-testid="smart-row">
						<div class="top">
							<span class="name">{row.label}</span>
							<strong>nudge after {describeSwitch(row.nudgeMs)}</strong>
						</div>
						<p class="hint">
							{#if row.state === 'learned'}
								Learned from your last {Math.min(row.samples, 10)} swaps: you usually take {describeSwitch(
									row.usualMs ?? 0
								)}.
							{:else if row.state === 'set'}
								You set {describeSwitch(row.override?.ms ?? 0)} on {day(row.override?.since ?? 0)}.
								Swaps from before then are ignored. {row.samples} of {row.needed} swaps since, then I
								learn from them.
							{:else if row.state === 'set-learned'}
								Started from your {describeSwitch(row.override?.ms ?? 0)} (set {day(
									row.override?.since ?? 0
								)}), and now learned from the {row.samples} swaps since: you usually take {describeSwitch(
									row.usualMs ?? 0
								)}.
							{:else if row.fromAll}
								{row.samples} of {row.needed} swaps so far. Until then I use what you take over all dilators,
								{describeSwitch(row.usualMs ?? 0)}.
							{:else}
								{row.samples} of {row.needed} swaps so far. Until then I nudge after the window only.
							{/if}
							{#if row.forgotten > 0 && row.state !== 'set'}
								{row.forgotten} where you forgot to press were left out.
							{/if}
						</p>
						{#if row.recent.length}
							<p class="hint">
								Latest swaps: {row.recent.map((ms) => describeSwitch(ms)).join(' · ')}
							</p>
						{/if}
						<details class="own">
							<summary>{row.override ? 'Change my own swap time' : 'Set my own swap time'}</summary>
							<div class="edit">
								<label>
									<span class="hint">You usually take</span>
									<input
										type="number"
										min="0.5"
										step="0.5"
										class="num"
										value={shownMinutes(row)}
										oninput={(e) => (typed[row.label] = e.currentTarget.value)}
										aria-label={`Usual swap time for ${row.label}, in minutes`}
									/>
									<span class="hint">min</span>
								</label>
								<button class="pill strong" onclick={() => useMyValue(row)}>Use this</button>
								{#if row.override}
									<button class="pill" onclick={() => backToLearning(row)}>Back to learning</button>
								{/if}
							</div>
							<p class="hint">
								I start from your value and ignore the swaps from before now. New swaps are still
								learned from: once there are {row.needed} of them they take over. I still never nudge
								sooner than the window above.
							</p>
						</details>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="block">
		<div class="item-head">
			<span class="label">Alarm sound</span>
			<button class="pill strong" onclick={testSound}>🔔 Test</button>
		</div>
		<label class="volume">
			<span class="hint">Volume</span>
			<input
				type="range"
				min="0"
				max="100"
				step="5"
				bind:value={draft.volume}
				onchange={() => {
					setVolume(Number(draft.volume) / 100);
					previewSound();
				}}
				aria-label="Alarm volume"
			/>
			<span class="value">{Number(draft.volume) === 0 ? 'Off' : `${draft.volume}%`}</span>
		</label>
		{#if Number(draft.volume) === 0}
			<p class="hint">
				Sounds are off. The screen still shows your timers, and your phone may still vibrate.
			</p>
		{:else}
			<p class="hint">
				Still too quiet? On iPhone, tap Test and use the volume buttons while it plays, because the
				alarm uses your media volume. It needs iOS 17 or newer to ring with the silent switch on.
			</p>
		{/if}
	</div>

	{#if isNative()}
		<div class="block">
			<div class="item-head">
				<span class="label">Locked-screen alerts</span>
				{#if store.alertsPermission === 'granted'}
					<button class="pill strong" onclick={testAlert}>Send a test</button>
				{:else if store.alertsPermission === 'prompt'}
					<button class="pill strong" onclick={() => store.enableLockedScreenAlerts()}>
						Turn on
					</button>
				{/if}
			</div>
			<p class="hint">
				When your phone is locked or the app is in the background, it still alerts you the moment a
				timer ends, then gently reminds you if you haven't switched yet.
			</p>
			{#if store.alertsPermission === 'granted'}
				<p class="hint ok">
					On ✓ Press "Send a test", then lock your phone: it arrives in 10 seconds.
				</p>
			{:else if store.alertsPermission === 'denied'}
				<p class="hint bad">
					Off. Allow notifications for Dilation timer in your phone's settings to get these.
				</p>
			{:else if store.alertsPermission === 'prompt'}
				<p class="hint">Not allowed yet. Press "Turn on" and say yes when your phone asks.</p>
			{/if}
			{#if alertNote}<p class="hint" role="status">{alertNote}</p>{/if}
			{#if settingsVolumeOff || nativePlatform() === 'ios'}
				<p class="hint">
					{#if settingsVolumeOff}Alerts are silent while the alarm volume is off.{/if}
					{#if nativePlatform() === 'ios'}
						On iPhone, alerts use your normal notification sound and follow the silent switch.
					{/if}
				</p>
			{/if}
		</div>
		{#if device}
			<div class="block" id="battery" data-testid="battery-help">
				<div class="item-head">
					<span class="label">Battery and alerts</span>
					{#if !device.unrestricted}
						<button class="pill strong" onclick={() => openAppSettings()}>Open app settings</button>
					{/if}
				</div>
				{#if device.unrestricted}
					<p class="hint ok">
						Your phone isn't limiting Dilation timer's battery use ✓ Alerts can reach you while it's
						locked.
					</p>
				{:else}
					<p class="hint">
						{advice.who === 'some phones' ? 'Some phones' : advice.who} put apps to sleep to save battery.
						Then the alarm may not ring, and alerts can arrive late or not at all while your phone is
						locked or the app is in the background. To fix that:
					</p>
					<ol class="hint steps">
						{#each advice.steps as step (step)}<li>{step}</li>{/each}
					</ol>
					<p class="hint">
						The wording differs a little between phones. When you come back here, this note updates
						by itself.
					</p>
				{/if}
			</div>
		{/if}
	{/if}

	<div class="block" id="reminders">
		<div class="item-head">
			<span class="label">Daily reminders</span>
			{#if isNative()}
				<input
					type="checkbox"
					class="toggle"
					checked={reminders.enabled}
					onchange={(e) => changeReminders({ ...reminders, enabled: e.currentTarget.checked })}
					aria-label="Daily reminders"
				/>
			{/if}
		</div>
		{#if !isNative()}
			<p class="hint">
				Daily reminders to start your session are part of the phone app, because a website can't
				reliably wake your phone up. Get the app to use them.
			</p>
		{:else}
			<p class="hint">
				Your phone reminds you at the time you pick for each session, on the days that have one.
				From the reminder you can start the session, ask to be reminded again in 30 minutes, or turn
				that one off.
			</p>
			{#if reminders.enabled}
				<ReminderTimes value={reminders} slots={reminderSlots} onchange={changeReminders} />
				{#if store.alertsPermission === 'denied'}
					<p class="hint bad">
						Allow notifications for Dilation timer in your phone's settings to get these.
					</p>
				{/if}
				<p class="hint">
					Reminders are planned two weeks ahead each time you open the app, so open it now and then.
				</p>
			{/if}
		{/if}
	</div>
</div>
