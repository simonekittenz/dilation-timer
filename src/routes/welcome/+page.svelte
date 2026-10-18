<script lang="ts">
	import { goto } from '$app/navigation';
	import Mascot from '$lib/Mascot.svelte';
	import release from '$lib/appRelease.json';
	import { store } from '$lib/store.svelte';
	import { describeDownload, detectPlatform, hasSeenWelcome, markWelcomeSeen } from '$lib/welcome';

	const android = release.android;
	const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
	// someone who already uses the app (or came back here on purpose) gets a "back" button
	const returning = store.hasSavedData || hasSeenWelcome();

	function useWeb() {
		markWelcomeSeen('web');
		void goto('/');
	}
</script>

<svelte:head><title>Welcome · Dilation timer</title></svelte:head>

<header>
	<Mascot size={110} />
	<h1>Welcome! 🌸</h1>
	<p class="muted">
		Dilation timer keeps your sessions, your schedule and your dilator switches in one cosy place.
		Pick how you'd like to use it.
	</p>
</header>

<div class="choices">
	<section class="card choice android" class:recommended={platform === 'android'} id="android">
		{#if platform === 'android'}<span class="badge">Best for your phone ♡</span>{/if}
		<h2>📱 Android app</h2>
		<ul>
			<li>
				Turns your <strong>music down</strong> for the alarm instead of stopping it, then back up
			</li>
			<li>Sound just works, with no "tap to turn the sound on" step</li>
			<li>Its own bunny icon on your home screen</li>
		</ul>
		<a class="btn" href={android.file} download onclick={() => markWelcomeSeen('android')}>
			⬇ Download for Android
		</a>
		<p class="muted small" data-testid="download-info">{describeDownload(android)}</p>
		{#if platform === 'ios'}
			<p class="note">This one is for Android phones only.</p>
		{/if}
		<details>
			<summary>How do I install it?</summary>
			<ol>
				<li>
					Tap <strong>Download for Android</strong>. If your browser warns that this kind of file
					can be harmful, choose <strong>Download anyway</strong>. The app isn't on the Play Store
					yet, which is why Android asks for a few extra taps.
				</li>
				<li>
					Open the downloaded file. If asked, allow your browser to
					<strong>install unknown apps</strong>.
				</li>
				<li>
					Tap <strong>Install</strong>. If Play Protect says it doesn't recognise the app, tap
					<strong>More details → Install anyway</strong>.
				</li>
				<li>
					To update later, download the newest file here and install it over the old one. Your data
					stays.
				</li>
			</ol>
			<p class="muted small">
				File check, if you like: SHA-256 <code>{android.sha256}</code>
			</p>
		</details>
	</section>

	<section class="card choice ios" id="ios">
		<h2>🍎 iPhone app</h2>
		<p>Coming later. For now the web version is the way to go on an iPhone.</p>
	</section>

	<section class="card choice web" class:recommended={platform !== 'android'} id="web">
		{#if platform !== 'android'}<span class="badge">Best for your device ♡</span>{/if}
		<h2>🌐 Web version</h2>
		<ul>
			<li>Nothing to install. It works on any phone or computer</li>
			<li>Add it to your home screen to use it like an app</li>
		</ul>
		<button class="btn" onclick={useWeb}>
			{returning ? 'Back to the app' : 'Use the web version'} →
		</button>
		<details>
			<summary>Put it on my home screen</summary>
			<ul>
				<li>
					<strong>iPhone:</strong> in Safari tap the Share button, then
					<strong>Add to Home Screen</strong>.
				</li>
				<li>
					<strong>Android:</strong> in Chrome tap ⋮, then <strong>Install app</strong> (or Add to Home
					screen).
				</li>
			</ul>
		</details>
	</section>
</div>

<section class="card limits">
	<h2>What the web version can't do on a phone</h2>
	<ul>
		<li>
			<span class="icon">🔒</span>
			<span>
				<strong>The alarm needs the app open, with the screen on.</strong> If your phone locks or you
				switch to another app, the timer still keeps perfect time, but you won't hear the ping until you
				come back. The app asks your phone to stay awake during a session, but pressing the lock button
				overrides that.
			</span>
		</li>
		<li>
			<span class="icon">🎵</span>
			<span>
				<strong>It can't turn your music down.</strong> On an iPhone the alarm pauses Spotify and friends
				and doesn't restart them. The Android app asks your music to get quieter for a moment instead,
				then back to normal.
			</span>
		</li>
		<li>
			<span class="icon">🔔</span>
			<span>
				<strong>iPhone: the alarm needs one tap first.</strong> That's a Safari rule. Also, the silent
				switch can mute the alarm unless your iPhone has iOS 17 or newer.
			</span>
		</li>
		<li>
			<span class="icon">💾</span>
			<span>
				<strong>Your history lives in your browser.</strong> If browser data is cleared, or Safari
				on iPhone tidies up a website you haven't opened for a while, it's gone. Adding the website
				to your home screen helps, and <strong>Settings → Save backup</strong> keeps a safe copy.
			</span>
		</li>
	</ul>
	<p class="note">
		<strong>Neither version can be relied on to ring while the phone is locked yet,</strong> because phones
		pause apps when the screen goes off to save battery. Keep the screen on during a session. A proper
		fix is on the wish list.
	</p>
</section>

<p class="muted small moving">
	Already using the web version? Nothing changes for you; your data stays where it is. Moving to the
	app starts it empty: use <strong>Settings → Save backup</strong> here, then
	<strong>Restore backup</strong> in the app.
</p>

<style>
	header {
		display: grid;
		justify-items: center;
		gap: 0.4rem;
		text-align: center;
		margin-bottom: 1.2rem;
	}
	h1 {
		font-size: 1.9rem;
		font-weight: 900;
		color: var(--accent-strong);
	}
	.choices {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.choice {
		position: relative;
		display: grid;
		gap: 0.7rem;
		justify-items: start;
	}
	.choice.recommended {
		border-color: var(--accent-strong);
		box-shadow:
			0 4px 0 var(--accent),
			var(--shadow);
	}
	.android {
		order: 2;
	}
	.android.recommended {
		order: 1;
	}
	.ios {
		order: 3;
	}
	.web {
		order: 2;
	}
	.web.recommended {
		order: 1;
	}
	.ios {
		opacity: 0.8;
	}
	.badge {
		font-size: 0.78rem;
		font-weight: 800;
		padding: 0.15rem 0.7rem;
		border-radius: 999px;
		background: var(--accent-strong);
		color: var(--accent-ink);
	}
	h2 {
		font-size: 1.2rem;
		font-weight: 900;
	}
	ul,
	ol {
		margin: 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.35rem;
	}
	.btn {
		display: inline-block;
		text-decoration: none;
	}
	.small {
		font-size: 0.82rem;
	}
	.note {
		font-size: 0.9rem;
		padding: 0.5rem 0.8rem;
		border-radius: 14px;
		background: var(--accent-soft);
	}
	details {
		width: 100%;
		color: var(--muted);
	}
	summary {
		cursor: pointer;
		font-weight: 800;
		color: var(--accent-strong);
	}
	details > :not(summary) {
		margin-top: 0.6rem;
	}
	code {
		font-size: 0.72rem;
		word-break: break-all;
	}
	.limits {
		margin-top: 1.2rem;
		display: grid;
		gap: 0.8rem;
	}
	.limits ul {
		list-style: none;
		padding: 0;
		gap: 0.8rem;
	}
	.limits li {
		display: grid;
		grid-template-columns: 1.8rem 1fr;
		gap: 0.5rem;
		font-size: 0.95rem;
	}
	.icon {
		font-size: 1.3rem;
	}
	.moving {
		margin: 1rem 0.2rem 0;
	}
</style>
