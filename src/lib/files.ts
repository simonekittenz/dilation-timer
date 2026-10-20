import { isNative } from '#lib/platform.ts';

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hands a text file to the user. In the phone app it opens the system share sheet (Google Drive,
 * Files, email...). In a browser it uses the share sheet where there is one and downloads otherwise.
 */
export async function saveTextFile(name: string, text: string): Promise<SaveResult> {
	if (isNative()) {
		// The app's web view can neither share files nor download them, so go through the native
		// plugins: write the file to the cache folder, then share it from there.
		try {
			const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
				import('@capacitor/filesystem'),
				import('@capacitor/share')
			]);
			const { uri } = await Filesystem.writeFile({
				path: name,
				data: text,
				directory: Directory.Cache,
				encoding: Encoding.UTF8
			});
			await Share.share({ title: name, files: [uri], dialogTitle: 'Save your backup' });
			return 'shared';
		} catch (e) {
			if (isCancel(e)) return 'cancelled';
			throw e;
		}
	}

	const file = new File([text], name, { type: 'application/json' });
	const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
	if (nav.share && nav.canShare?.({ files: [file] })) {
		try {
			await nav.share({ files: [file], title: name });
			return 'shared';
		} catch (e) {
			if (isCancel(e)) return 'cancelled';
			// fall through to a normal download
		}
	}
	const url = URL.createObjectURL(file);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
	return 'downloaded';
}

function isCancel(e: unknown): boolean {
	if (e instanceof DOMException && e.name === 'AbortError') return true;
	return /cancel/i.test(e instanceof Error ? e.message : String(e));
}
