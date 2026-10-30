/** A question put to the user, in our own pretty pop up instead of the browser's plain `confirm()`. */
export interface AskOptions {
	title: string;
	/** A line or two under the title. Line breaks are kept. */
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	/**
	 * Something that can't be undone. The safe answer is then the big friendly button, and the
	 * destructive one is the quiet one.
	 */
	danger?: boolean;
}

class Dialog {
	current = $state<(AskOptions & { resolve: (answer: boolean) => void }) | null>(null);

	ask(options: AskOptions): Promise<boolean> {
		// a second question while one is open counts as "no" to the first
		this.current?.resolve(false);
		return new Promise((resolve) => {
			this.current = { ...options, resolve };
		});
	}

	answer(yes: boolean) {
		const open = this.current;
		this.current = null;
		open?.resolve(yes);
	}
}

export const dialog = new Dialog();

/** `if (await ask({ title: 'Delete this?', danger: true })) …` */
export const ask = (options: AskOptions) => dialog.ask(options);
