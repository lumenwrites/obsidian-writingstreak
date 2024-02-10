import { PluginSettingTab, App, Setting, Notice } from "obsidian";
import WritingStreakPlugin from "main";
import { FolderSuggest } from "./suggesters/FolderSuggester";

export interface WritingStreakSettings {
	sessionDuration: number;
	speed: "slow" | "medium" | "fast" | "very-fast";
	folderPath: string;
}

export const DEFAULT_SETTINGS: WritingStreakSettings = {
	sessionDuration: 5,
	speed: "medium",
	folderPath: "_assets/data",
};

export class WritingStreakSettingTab extends PluginSettingTab {
	plugin: WritingStreakPlugin;

	constructor(app: App, plugin: WritingStreakPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", {
			text: "Writing Streak: Settings",
		});

		new Setting(containerEl).setName("Session duration").addText((text) =>
			text
				.setPlaceholder("Enter duration in minutes")
				.setValue(this.plugin.settings.sessionDuration.toString())
				.onChange(async (value) => {
					const updatedDuration = parseInt(value) || 20;
					if (!updatedDuration) {
						return new Notice(
							`Error: value '${value}' is not a valid session length.`
						);
					}
					this.plugin.settings.sessionDuration = updatedDuration;
					this.plugin.saveSettings();
				})
		);
		new Setting(containerEl)
			.setName("Sprint Speed")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("slow", "Slow")
					.addOption("medium", "Medium")
					.addOption("fast", "Fast")
					.addOption("very-fast", "Very Fast")
					.setValue(this.plugin.settings.speed)
					.onChange(async (value: "slow" | "medium" | "fast") => {
						console.log("Set speed to:", value);
						this.plugin.settings.speed = value;
						this.plugin.saveSettings();
					})
			);
		// Folder selection setting
		new Setting(containerEl)
			.setName("Save Folder")
			.setDesc("Choose a folder where to save your writing stats")
			.addSearch((cb) => {
				new FolderSuggest(cb.inputEl);
				cb.setPlaceholder("Example: folder1/folder2")
					.setValue(this.plugin.settings.folderPath)
					.onChange((new_folder) => {
						this.plugin.settings.folderPath = new_folder;
						console.log("Set folder path", new_folder);
						this.plugin.saveSettings();
					});
				// @ts-ignore
				cb.containerEl.addClass("templater_search");
			});
	}
}
