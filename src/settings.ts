import { PluginSettingTab, App, Setting, Notice } from "obsidian";
import WritingStreakPlugin from "main";

export interface WritingStreakSettings {
	sessionDuration: number;
	speed: "slow" | "medium" | "fast";
}

export const DEFAULT_SETTINGS: WritingStreakSettings = {
	sessionDuration: 5,
	speed: "medium",
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
					.setValue(this.plugin.settings.speed)
					.onChange(async (value: "slow" | "medium" | "fast") => {
						console.log("Set speed to:", value);
						this.plugin.settings.speed = value;
						this.plugin.saveSettings();
					})
			);
	}
}
