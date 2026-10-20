import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const writeFile = vi.fn();
const share = vi.fn();

vi.mock('@capacitor/filesystem', () => ({
	Filesystem: { writeFile },
	Directory: { Cache: 'CACHE' },
	Encoding: { UTF8: 'utf8' }
}));
vi.mock('@capacitor/share', () => ({ Share: { share } }));

beforeEach(() => {
	vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true } });
	writeFile.mockReset().mockResolvedValue({ uri: 'file:///cache/backup.json' });
	share.mockReset().mockResolvedValue({});
});

afterEach(() => vi.unstubAllGlobals());

describe('saveTextFile in the app', () => {
	it('writes the file to the cache folder and opens the share sheet for it', async () => {
		const { saveTextFile } = await import('./files');
		expect(await saveTextFile('backup.json', '{"a":1}')).toBe('shared');
		expect(writeFile).toHaveBeenCalledWith({
			path: 'backup.json',
			data: '{"a":1}',
			directory: 'CACHE',
			encoding: 'utf8'
		});
		expect(share.mock.calls[0][0].files).toEqual(['file:///cache/backup.json']);
	});

	it('treats closing the share sheet as cancelling, not as an error', async () => {
		share.mockRejectedValue(new Error('Share canceled'));
		const { saveTextFile } = await import('./files');
		expect(await saveTextFile('backup.json', '{}')).toBe('cancelled');
	});

	it('lets real failures through so the page can tell the user', async () => {
		writeFile.mockRejectedValue(new Error('disk full'));
		const { saveTextFile } = await import('./files');
		await expect(saveTextFile('backup.json', '{}')).rejects.toThrow('disk full');
	});
});
