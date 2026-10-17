export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hands a text file to the user. On phones this opens the share sheet (so it can go to Files,
 * AirDrop, Messages...); elsewhere it downloads. Pure browser APIs, so it works in the web app
 * and in the native wrapper alike.
 */
export async function saveTextFile(name: string, text: string): Promise<SaveResult> {
	const file = new File([text], name, { type: 'application/json' });
	const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
	if (nav.share && nav.canShare?.({ files: [file] })) {
		try {
			await nav.share({ files: [file], title: name });
			return 'shared';
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
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
