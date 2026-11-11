<script lang="ts">
	import { previewSound, setVolume, testSound } from '#lib/alarm.ts';
	import { isNative, nativePlatform } from '#lib/platform.ts';
	import ReminderTimes from '#lib/ReminderTimes.svelte';
	import { describeSwitch } from '#lib/switchHistory.ts';
	import { defaultReminders, slotsInSchedule } from '#lib/reminders.ts';
	import { store } from '#lib/store.svelte.ts';
	import type { Reminders } from '#lib/types.ts';
	import { useSettingsForm } from '#lib/settingsForm.svelte.ts';

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
	<div class="block" data-testid="usual-switches">
		<span class="label">Your usual swap times</span>
		{#if store.usualSwitches.length}
			<p class="hint">
				I time how long you take to switch and nudge you when that time is up, never sooner than the
				window above. Swaps where you forgot to press the button don't count.
			</p>
			<ul class="usual">
				{#each store.usualSwitches as u (u.label)}
					<li>
						<span>{u.label}</span><strong
							>{describeSwitch(u.ms)} · nudge after {describeSwitch(u.nudgeMs)}</strong
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="hint">
				After a few sessions I'll learn how long you take to switch to each dilator and nudge you
				when that time is up. Until then only the window above counts.
			</p>
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
