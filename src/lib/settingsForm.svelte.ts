import { getContext, setContext, untrack } from 'svelte';
import { dayNumber } from './dates';
import { stepsInUse } from './dilators';
import { defaultMessages } from './messages';
import { phaseForDay } from './schedule';
import { buildSettings, messagesToText, type MessageText } from './settingsDraft';
import { store } from './store.svelte';
import type { Settings } from './types';

/**
 * The Settings form, shared by all the Settings pages. It lives in the Settings layout, so moving between
 * the pages keeps what is on screen, and every change is validated and stored straight away.
 */
export class SettingsForm {
	draft = $state<Settings>($state.snapshot(store.settings));
	messageText = $state<MessageText>(messagesToText(store.settings.messages));
	status = $state<'saved' | 'waiting'>('saved');
	#first = true;

	inUse = $derived(stepsInUse(this.draft));
	/** Until the surgery date has been chosen, startDate is only a placeholder that must not be shown. */
	hasDate = $derived(this.draft.setup !== 'ask-date' && this.draft.setup !== 'ask-program');
	day = $derived(this.hasDate ? dayNumber(this.draft.startDate, store.today) : 0);
	currentPhase = $derived(phaseForDay(this.draft.phases, this.day));

	/** Saves every change. Call it once, while the layout is being set up. */
	autosave() {
		$effect(() => {
			const next = buildSettings($state.snapshot(this.draft), $state.snapshot(this.messageText));
			if (this.#first) {
				this.#first = false;
				return;
			}
			if (!next) {
				this.status = 'waiting';
				return;
			}
			// untrack: saving reads the store's settings, which would make this effect re-trigger itself.
			untrack(() => store.updateSettings(next));
			this.status = 'saved';
		});
	}

	/** Picking the first surgery date here counts as answering the Today screen's question. */
	setStartDate(value: string) {
		if (this.draft.setup === 'ask-date' || this.draft.setup === 'ask-program') {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
			this.draft.setup = 'confirm';
		}
		this.draft.startDate = value;
	}

	resetMessages() {
		Object.assign(this.messageText, messagesToText(defaultMessages()));
	}

	/** Takes over what the store holds now (after a backup was restored). Updates in place. */
	reload() {
		const next = $state.snapshot(store.settings) as unknown as Record<string, unknown>;
		const draft = this.draft as unknown as Record<string, unknown>;
		for (const key of Object.keys(draft)) if (!(key in next)) delete draft[key];
		Object.assign(draft, next);
		Object.assign(this.messageText, messagesToText(store.settings.messages));
	}
}

const KEY = Symbol('settings-form');

export function provideSettingsForm(): SettingsForm {
	const form = new SettingsForm();
	form.autosave();
	setContext(KEY, form);
	return form;
}

export function useSettingsForm(): SettingsForm {
	return getContext<SettingsForm>(KEY);
}
