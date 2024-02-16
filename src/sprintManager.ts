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

export class SprintManager {
	view: MarkdownView;
	plugin: WritingStreakPlugin;

	// Settings
	sessionDuration: number;
	healthDecay: number;
	// Counters
	timeLeft: number;
	currentHealth: number;
	timerId: number | undefined;
	startWordCount: number;
	endWordCount: number;
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
				this.healthDecay = 0.01;
				break;
			case "medium":
				this.healthDecay = 0.03;
				break;
			case "fast":
				this.healthDecay = 0.05;
				break;
			case "very-fast":
				this.healthDecay = 0.15;
				break;
		}
		this.healthDecay = plugin.settings.healthDecay;
		this.setup();
		this.readSprintLog();
		this.startWordCount = this.getCurrentWordCount(view);
		this.timerId = window.setInterval(this.onTick.bind(this), TICK_LENGTH);
	}
	// Add a method to get the current word count from the active document
	getCurrentWordCount(view: MarkdownView): number {
		const editor = view.editor;
		const text = editor.getValue();
		const words = text.match(/\b[-?(\w+)?]+\b/gi);
		const currentWordCount = words ? words.length : 0;
		return currentWordCount;
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
		const currentWordCount = this.getCurrentWordCount(this.view);
		const wordsWritten = currentWordCount - this.startWordCount;
		const successfulSprints = this.successfulSprints;
		const timeLeftFormatted = formatTime(this.timeLeft);
		updateText(
			"timebar-text",
			`S:${successfulSprints} W:${wordsWritten} ${timeLeftFormatted}`
		);
	}

	onKeyPress() {
		// console.log('Gain health', this.currentHealth)
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
		// this.setupCodeMirror();
	}
	cleanup() {
		this.timeLeft = this.sessionDuration;
		this.currentHealth = DEFAULT_HEALTH;
		removeDivs();
		clearInterval(this.timerId);
	}

	async saveData(msg: string) {
		this.endWordCount = this.getCurrentWordCount(this.view);
		const wordsWritten = this.endWordCount - this.startWordCount;
		const currentDate = new Date().toISOString().split("T")[0];
		const currentTime = new Date()
			.toISOString()
			.split("T")[1]
			.split(".")[0];
		const duration = this.plugin.settings.sessionDuration; // In minutes
		const success = msg === "success"; // Determine success as a boolean
		const currentFile = this.plugin.app.workspace.getActiveFile();
		const documentTitle = currentFile?.basename;
		const documentPath = currentFile?.path;

		let newEntry = `- **Start:** ${currentTime}, **Duration:** ${duration} min, **Wordcount:** ${wordsWritten} words, **Success:** ${success}, **Doc:** [${documentTitle}](${documentPath})\n`;

		const folderPath = this.plugin.settings.folderPath;
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

	async readSprintLog() {
		const folderPath = this.plugin.settings.folderPath;
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
			} else if (line.startsWith("- **Start:**")) {
				// Check if the line is a sprint entry
				const entryParts = line.match(
					/- \*\*Start:\*\* (.*?), \*\*Duration:\*\* (.*?) min, \*\*Wordcount:\*\* (.*?) words, \*\*Success:\*\* (.*?), \*\*Doc:\*\* \[(.*?)\]\((.*?)\)/
				);
				if (entryParts && entryParts.length >= 7) {
					const start = entryParts[1];
					const duration = entryParts[2];
					const wordcount = entryParts[3];
					const success = entryParts[4] === "true";
					const documentTitle = entryParts[5];
					const documentPath = entryParts[6];

					const sprintEntry = {
						start: start,
						duration: parseInt(duration),
						wordcount: parseInt(wordcount),
						success: success,
						documentTitle: documentTitle,
						documentPath: documentPath,
					};

					jsonData[currentDate].push(sprintEntry);
				}
			}
		});
		this.sprints = jsonData;
		const todaysSprints =
			jsonData[new Date().toISOString().split("T")[0]] || [];
		this.successfulSprints = todaysSprints.filter((s) => s.success)?.length;
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
