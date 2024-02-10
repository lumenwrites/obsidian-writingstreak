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
	// Stats
	sprints: Record<string, Array<Record<string, string>>> = {};
	successfulSprints = 0;

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
			case "very-fast":
				this.healthDecay = 0.15;
				break;
		}
		this.setup();
		this.readSprintLog();

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

		// Decay health, update time
		this.currentHealth -= this.healthDecay;
		this.timeLeft -= TICK_LENGTH;
		// Clamp just in case
		this.currentHealth = Math.clamp(this.currentHealth, 0, DEFAULT_HEALTH);
		this.timeLeft = Math.clamp(this.timeLeft, 0, this.sessionDuration);
		// Update healthbar
		const healthProgress = (this.currentHealth / 100) * 100;
		updateProgressBar("healthbar-progress", healthProgress);
		// Update progressbars
		const timeProgress = (this.timeLeft / this.sessionDuration) * 100;
		updateProgressBar("timebar-progress", timeProgress);
		// Update text
		const todaysDate = new Date().toISOString().split("T")[0];
		updateText(
			"timebar-text",
			`[${this.successfulSprints}] ${formatTime(this.timeLeft)}`
		);
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
		const currentDate = new Date().toISOString().split("T")[0];
		const currentTime = new Date()
			.toISOString()
			.split("T")[1]
			.split(".")[0];
		const duration = this.plugin.settings.sessionDuration; // Assuming this is in minutes
		const outcome = msg; // 'Success' or 'Fail'

		// Get the currently opened document's title and path
		const currentFile = this.plugin.app.workspace.getActiveFile();
		const documentTitle = currentFile?.basename; // The title is usually the basename of the file
		const documentPath = currentFile?.path;

		let newEntry = `- **${currentTime}** ${duration} min - ${outcome} - [${documentTitle}](${documentPath})\n`;

		const folderPath = "_assets/data";
		const fileName = "writingstreak.md";
		let file = this.plugin.app.vault.getAbstractFileByPath(
			`${folderPath}/${fileName}`
		) as TFile;

		if (!file) {
			file = await this.plugin.app.vault.create(
				`${folderPath}/${fileName}`,
				`# Writing Sprint Log\n\n## ${currentDate}\n${newEntry}`
			);
		} else {
			let content = await this.plugin.app.vault.read(file);
			if (!content.includes(`## ${currentDate}`)) {
				content += `\n## ${currentDate}\n`;
			}
			content += newEntry;
			await this.plugin.app.vault.modify(file, content);
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
	async readSprintLog() {
		const folderPath = "_assets/data";
		const fileName = "writingstreak.md";
		const file = this.plugin.app.vault.getAbstractFileByPath(
			`${folderPath}/${fileName}`
		) as TFile;

		if (!file) {
			console.log("File does not exist");
			return {}; // Return an empty object if the file doesn't exist
		}

		const content = await this.plugin.app.vault.read(file);
		const lines = content.split("\n"); // Split the file content into lines

		let jsonData = {};
		let currentDate = "";

		lines.forEach((line) => {
			if (line.startsWith("## ")) {
				// Check if the line is a date header
				currentDate = line.substring(3); // Remove '## ' to get the date
				jsonData[currentDate] = []; // Initialize an empty array for this date
			} else if (line.startsWith("- **")) {
				// Check if the line is a sprint entry
				const entryParts = line.match(
					/\*\*(.*?)\*\* (.*?) min - (.*?) - \[(.*?)\]\((.*?)\)/
				);
				if (entryParts && entryParts.length >= 6) {
					const time = entryParts[1];
					const duration = entryParts[2];
					const outcome = entryParts[3];
					const documentTitle = entryParts[4];
					const documentPath = entryParts[5];

					const sprintEntry = {
						time: time,
						duration: duration,
						outcome: outcome,
						documentTitle: documentTitle,
						documentPath: documentPath,
					};

					jsonData[currentDate].push(sprintEntry);
				}
			}
		});

		this.sprints = jsonData;
		this.successfulSprints =
			jsonData[new Date().toISOString().split("T")[0]]?.filter(
				(sprint) => sprint.outcome === "success"
			)?.length || 0;
		console.log("[readSprintLog]", this.sprints);
		return jsonData;
	}
}

function formatTime(ms: number): string {
	const minutes = Math.floor(ms / 60000); // 60,000 milliseconds in a minute
	const seconds = Math.floor((ms % 60000) / 1000); // Remainder in seconds

	// Format minutes and seconds to always be two digits
	const formattedMinutes = minutes.toString().padStart(2, "0");
	const formattedSeconds = seconds.toString().padStart(2, "0");

	return `${formattedMinutes}:${formattedSeconds}`;
}
