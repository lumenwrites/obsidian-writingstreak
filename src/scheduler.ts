import {
	App,
	Editor,
	EditorPosition,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { StateField } from "@codemirror/state";
import { setupDivs, updateProgressBar, removeDivs, updateText } from "src/dom";
import WritingStreakPlugin from "main";

type args = {
	view: MarkdownView;
	plugin: WritingStreakPlugin;
};

const TICK_LENGTH = 10;
const DEFAULT_HEALTH = 105.0;
const HEALTH_GAIN = 1.0;

export class Scheduler {
	view: MarkdownView;
	plugin: WritingStreakPlugin;

	// Settings
	sessionDuration: number;
	healthDecay: number;
	// Counters
	timeLeft: number;
	currentHealth: number;
	timerId: number | undefined;

	constructor() {}

	startSprint({ view, plugin }: args) {
		this.view = view;
		this.plugin = plugin;
		this.sessionDuration = plugin.settings.sessionDuration * 60 * 1000;
		switch (plugin.settings.speed) {
			case "slow":
				this.healthDecay = 0.02;
				break;
			case "medium":
				this.healthDecay = 0.04;
				break;
			case "fast":
				this.healthDecay = 0.06;
				break;
		}
		this.setup();
		this.timerId = window.setInterval(this.onTick.bind(this), TICK_LENGTH);
	}

	onTick() {
		const { timeLeft, currentHealth } = this;
		if (timeLeft <= 0) {
			this.succeed();
			return;
		}
		if (currentHealth <= 0) {
			console.log("currentHealth", currentHealth);
			this.fail();
			return;
		}

		// Decrease time left, decay health
		this.timeLeft -= TICK_LENGTH;
		this.currentHealth -= this.healthDecay;
		// Clamp just in case
		this.timeLeft = Math.clamp(this.timeLeft, 0, this.sessionDuration);
		this.currentHealth = Math.clamp(this.currentHealth, 0, DEFAULT_HEALTH);
		// Update progressbars
		const timeProgress = (this.timeLeft / this.sessionDuration) * 100;
		updateProgressBar("timebar-progress", timeProgress);
    const secondsLeft = Math.floor(this.timeLeft / 1000)
    const minutesLeft = Math.floor(secondsLeft / 60)
    updateText("timebar-text", `${minutesLeft}:${secondsLeft - minutesLeft * 60}`)
		const healthProgress = (this.currentHealth / 100) * 100;
		updateProgressBar("healthbar-progress", healthProgress);
	}

	onKeyPress() {
		this.currentHealth += HEALTH_GAIN;
	}

	succeed() {
		new Notice("Success!");
		this.cleanup();
	}

	fail() {
		new Notice("Fail!");
		this.cleanup();
	}

	setup() {
		this.cleanup();
		setupDivs(this.view);
		this.setupCodeMirror();
	}
	cleanup() {
		this.timeLeft = this.sessionDuration;
		this.currentHealth = DEFAULT_HEALTH;
		removeDivs();
		clearInterval(this.timerId);
	}
	setupCodeMirror() {
		// Codemirror magic that runs function on keypress
		const cmExtensions: Array<StateField<unknown>> = [];
		const onInputKeypress = StateField.define({
			create: () => null,
			update: (_, transaction) => {
				if (!transaction.docChanged) {
					return null;
				}
				if (transaction.isUserEvent("input")) {
					this.onKeyPress();
				}
				return null;
			},
		});
		cmExtensions.push(onInputKeypress);
		this.plugin.registerEditorExtension(cmExtensions);
		console.log("Registered CodeMirror hook");
	}
}
