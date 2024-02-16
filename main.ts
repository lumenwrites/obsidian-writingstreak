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



import { StateField } from "@codemirror/state";

export default class WritingStreakPlugin extends Plugin {
	settings: WritingStreakSettings;
	sprintManager: SprintManager;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new WritingStreakSettingTab(this.app, this));

		this.sprintManager = new SprintManager();
		this.setupCodeMirror()
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
					console.log('keypress')
					this.sprintManager.onKeyPress();
				}
				return null;
			},
		});
		cmExtensions.push(onInputKeypress);
		this.registerEditorExtension(cmExtensions);
		console.log("Registered CodeMirror hook");
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
