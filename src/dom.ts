/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { View } from "obsidian";


export function setupDivs(view: View) {
	const root = (view as ExtendedView).leaf.parent.tabsContainerEl;
	// Set this element as the progress bar's containing block.
	root.style.position = "relative";
	// Bars container
	const container = createDiv("sprint-bars-container", root);
	// Healthbar
	const healthbar = createDiv("healthbar", container);
	const healthbarProgress = createDiv("healthbar-progress", healthbar);
	healthbarProgress.style.width = `100%`;
	// Timebar
	const timebar = createDiv("timebar", container);
	const timebarProgress = createDiv("timebar-progress", timebar);
	// timebarProgress.style.width = `100%`;
	const timebarText = createDiv("timebar-text", timebar);
	timebarText.textContent = "00:00";
}

export function updateProgressBar(id, progress: number) {
	const progressDiv = activeDocument.getElementById(id);
	progressDiv!.style.width = `${progress}%`;
}
export function updateText(id, text: string) {
	const div = activeDocument.getElementById(id);
	div!.textContent = text;
}

export function removeDivs() {
	const container = activeDocument.getElementById("sprint-bars-container");
	container?.remove();
}

function createDiv(id, parent) {
	const newDiv = activeDocument.createElement("div");
	newDiv.id = id;
	parent.appendChild(newDiv);
	return newDiv;
}

type ExtendedView = View & {
	leaf: {
		parent: {
			tabsContainerEl: HTMLElement;
		};
	};
};
