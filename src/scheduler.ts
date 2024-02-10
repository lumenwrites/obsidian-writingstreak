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
	TFile,
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
		const secondsLeft = Math.floor(this.timeLeft / 1000);
		const minutesLeft = Math.floor(secondsLeft / 60);
		updateText(
			"timebar-text",
			`${minutesLeft}:${secondsLeft - minutesLeft * 60}`
		);
		const healthProgress = (this.currentHealth / 100) * 100;
		updateProgressBar("healthbar-progress", healthProgress);
	}

	onKeyPress() {
		this.currentHealth += HEALTH_GAIN;
	}

	succeed() {
		new Notice("Success!");
		this.saveData("success");
		this.cleanup();
	}

	fail() {
		new Notice("Fail!");
		this.saveData("fail");
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
	async saveData(msg: string) {
		let data = ""; // Replace this with the data you want to save
		const folderPath = "_assets/data"; // Replace this with the path to the folder
		const fileName = "writingstreak.md"; // Replace this with the name of the file
		// Add a line at the end of the file in the following format: 2021-01-01 12:00:00 - sessionDuration min
		const date = new Date().toISOString().split("T")[0];
		const time = new Date().toISOString().split("T")[1].split(".")[0];
		data = `${date} ${time} ${this.plugin.settings.sessionDuration} min - ${msg}`;
		// Create the file if it doesn't exist
		let file = this.plugin.app.vault.getAbstractFileByPath(
			`${folderPath}/${fileName}`
		) as TFile;
		if (!file) {
			file = await this.plugin.app.vault.create(
				`${folderPath}/${fileName}`,
				data
			);
		} else {
			// If the file already exists, append the data to it
			const currentContent = await this.plugin.app.vault.read(file);
			const newContent = currentContent + "\n" + data;
			await this.plugin.app.vault.modify(file, newContent);
		}
	}
	async readData() {
		const folderPath = "_assets/data"; // Replace this with the path to the folder
		const fileName = "writingstreak.md"; // Replace this with the name of the file
		// Get the file
		const file = this.plugin.app.vault.getAbstractFileByPath(
			`${folderPath}/${fileName}`
		) as TFile;
		if (file) {
			// If the file exists, read the data from it
			const content = await this.plugin.app.vault.read(file);
			console.log(content); // Replace this with what you want to do with the content
		} else {
			console.log("File does not exist"); // Replace this with what you want to do if the file does not exist
		}
	}
}
