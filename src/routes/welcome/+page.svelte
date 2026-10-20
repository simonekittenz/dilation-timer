<script lang="ts">
	import { goto } from '$app/navigation';
	import Mascot from '$lib/Mascot.svelte';
	import release from '$lib/appRelease.json';
	import { store } from '$lib/store.svelte';
	import {
		describeDownload,
		detectPlatform,
		hasSeenWelcome,
		markWelcomeSeen,
		playStoreUrl
	} from '$lib/welcome';

	const android = release.android;
	// set once the app is on Google Play; until then only the downloadable file is offered
	const playUrl = playStoreUrl(android);
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
		{#if playUrl}
			<a
				class="btn"
				href={playUrl}
				data-testid="play-link"
				onclick={() => markWelcomeSeen('android')}
			>
				▶ Get it on Google Play
			</a>
			<a
				class="btn ghost small"
				href={android.file}
				download
				onclick={() => markWelcomeSeen('android')}
			>
				Or download the app file directly
			</a>
		{:else}
			<a class="btn" href={android.file} download onclick={() => markWelcomeSeen('android')}>
				⬇ Download for Android
			</a>
		{/if}
		<p class="muted small" data-testid="download-info">{describeDownload(android)}</p>
		{#if platform === 'ios'}
			<p class="note">This one is for Android phones only.</p>
		{/if}
		<details>
			<summary>How do I install it?</summary>
			<ol>
				<li>
					Tap <strong
						>{playUrl ? 'Or download the app file directly' : 'Download for Android'}</strong
					>. If your browser warns that this kind of file can be harmful, choose
					<strong>Download anyway</strong>.{playUrl
						? ' (Installing from Google Play skips all of this.)'
						: " The app isn't on the Play Store yet, which is why Android asks for a few extra taps."}
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
		<strong>The web version can't ring while the phone is locked,</strong> because phones pause web pages
		when the screen goes off to save battery. Keep the screen on during a session. The Android app does
		better: it asks your phone's own alarm clock to show an alert when a timer ends, even with the screen
		off. That alert is a normal notification (it won't lower your music).
	</p>
</section>

<p class="muted small moving">
	Already using the web version? Nothing changes for you; your data stays where it is. Moving to the
	app starts it empty: use <strong>Settings → Save backup</strong> here, then
	<strong>Restore backup</strong> in the app.
</p>

<section class="card community" data-testid="community">
	<header class="who">
		<Mascot size={64} />
		<h2>A project for the trans community 🌸</h2>
	</header>
	<p class="story">
		Hi there! I'm Simone, or Zephyra, a trans girl like you! I had my PPV surgery at WIH in
		September 2025. I started Dilation timer, for us. I use the app myself, and it warms my heart to
		know it helps others. I keep it free, and try to make it just nice to use, free and simple,
		because we deserve that.
	</p>
	<p class="disclaimer">
		Disclaimer: AI has been used to write the code for the app, but never in the app itself.
		Everything is carefully reviewed, tested and used by me and some other girls.
	</p>
	<div class="support">
		<p>
			If it helps you and you'd like to show some support, you can buy me a coffee. It can help pay
			for some of the costs of maintaining the apps and the stores involved. But feel no pressure at
			all!
		</p>
		<a
			class="btn ghost kofi"
			href="https://ko-fi.com/zephyralux"
			target="_blank"
			rel="noopener noreferrer"
			data-testid="kofi">☕ Buy me a coffee on Ko-fi</a
		>
	</div>
</section>

<p class="muted small moving"><a href="/privacy">How your information is handled</a></p>

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
	.community {
		display: grid;
		gap: 0.9rem;
		margin-top: 1.6rem;
		padding: 1.2rem 1.1rem 1.3rem;
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--accent-soft) 70%, var(--surface)),
			var(--surface) 60%
		);
	}
	.community .who {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.7rem;
		margin: 0;
		text-align: left;
	}
	.community h2 {
		text-align: left;
		font-size: 1.15rem;
		font-weight: 900;
		line-height: 1.2;
		color: var(--accent-strong);
	}
	.community p {
		line-height: 1.55;
	}
	.community .disclaimer {
		padding: 0.1rem 0 0.1rem 0.8rem;
		border-left: 4px solid var(--accent);
		color: var(--muted);
		font-size: 0.88rem;
	}
	.community .support {
		display: grid;
		gap: 0.7rem;
		padding-top: 0.8rem;
		border-top: 2px dashed var(--line);
	}
	.community .support p {
		color: var(--muted);
		font-size: 0.92rem;
	}
	.community .kofi {
		display: block;
		text-align: center;
		padding: 0.85rem 1rem;
	}
</style>
