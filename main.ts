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
import { SprintManager } from "src/sprintManager";
import {
	WritingStreakSettings,
	WritingStreakSettingTab,
	DEFAULT_SETTINGS,
} from "src/settings";

export default class WritingStreakPlugin extends Plugin {
	settings: WritingStreakSettings;
	sprintManager: SprintManager;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new WritingStreakSettingTab(this.app, this));

		this.sprintManager = new SprintManager();

		this.addCommand({
			id: "sprint",
			name: `Sprint`,
			icon: "play-circle",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.sprintManager.startSprint({ view, plugin: this });
			},
		});

		this.addCommand({
			id: "stop-sprint",
			name: `Stop sprint`,
			icon: 'stop-circle',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.sprintManager.cleanup();
			},
		});
	}

	onunload() {
		this.sprintManager.cleanup();
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
