/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import { Scheduler } from "src/scheduler";
import {
	WritingStreakSettings,
	WritingStreakSettingTab,
	DEFAULT_SETTINGS,
} from "src/settings";

export default class WritingStreakPlugin extends Plugin {
	settings: WritingStreakSettings;
	scheduler: Scheduler;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new WritingStreakSettingTab(this.app, this));

		this.scheduler = new Scheduler();

		this.addCommand({
			id: "sprint",
			name: `Sprint`,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.scheduler.startSprint({ view, plugin: this });
			},
		});

		this.addCommand({
			id: "stop-sprint",
			name: `Stop sprint`,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.scheduler.cleanup();
			},
		});
	}

	onunload() {
		this.scheduler.cleanup();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
