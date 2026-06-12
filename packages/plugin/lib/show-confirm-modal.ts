import { App, Modal } from "obsidian";

export function showConfirmModal(
  app: App,
  options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  }
): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    class ConfirmModal extends Modal {
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: options.title });
        contentEl.createEl("p", { text: options.message });
        const buttonContainer = contentEl.createDiv({
          attr: { style: "display: flex; gap: 10px; margin-top: 1em;" },
        });
        buttonContainer
          .createEl("button", { text: options.cancelText ?? "Cancel" })
          .addEventListener("click", () => {
            resolve(false);
            this.close();
          });
        buttonContainer
          .createEl("button", {
            text: options.confirmText ?? "Confirm",
            attr: { style: "background: var(--interactive-accent);" },
          })
          .addEventListener("click", () => {
            resolve(true);
            this.close();
          });
      }
    }

    const modal = new ConfirmModal(app);
    modal.open();
  });
}
