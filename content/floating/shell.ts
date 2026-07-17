/**
 * Jobright-style floating logo + collapsible in-page drawer.
 *
 * Mounted once per frame via a shadow-DOM host so page CSS cannot bleed in
 * (or the drawer's styles leak out). The drawer hosts the existing popup UI
 * through an extension-origin iframe, so all auth/draft state continues to
 * live in chrome.storage exactly as it does for the toolbar popup today.
 */
import { getPanelExpanded, setPanelExpanded } from "./panelState.js";

const HOST_ATTRIBUTE = "data-flint-floating-shell";
const DRAWER_WIDTH_PX = 360;

const SHELL_STYLES = `
  :host {
    all: initial;
  }
  .fab {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #0f766e;
    border: none;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    z-index: 2147483647;
  }
  .fab:hover {
    background: #115e59;
  }
  .fab[hidden] {
    display: none;
  }
  .fab img {
    width: 28px;
    height: 28px;
    display: block;
    pointer-events: none;
  }
  .drawer {
    position: fixed;
    top: 24px;
    bottom: 24px;
    right: 20px;
    width: ${DRAWER_WIDTH_PX}px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 48px);
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 20px 48px rgba(15, 23, 42, 0.28);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .drawer[hidden] {
    display: none;
  }
  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
    flex-shrink: 0;
  }
  .drawer-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
  }
  .drawer-title img {
    width: 20px;
    height: 20px;
  }
  .drawer-close {
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .drawer-close:hover {
    background: #e2e8f0;
  }
  .drawer-frame {
    flex: 1;
    border: none;
    width: 100%;
  }
`;

export class FloatingShell {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private fabButton: HTMLButtonElement | null = null;
  private drawerEl: HTMLElement | null = null;
  private frameEl: HTMLIFrameElement | null = null;
  private expanded = false;
  private listenersBound = false;

  private readonly onDocumentClick = (event: MouseEvent): void => {
    if (!this.expanded || !this.host) return;
    if (event.composedPath().includes(this.host)) return;
    this.collapse();
  };

  private readonly onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.expanded) this.collapse();
  };

  mount(anchor: HTMLElement = document.body): void {
    if (this.host) return;

    const existing = document.querySelector(`[${HOST_ATTRIBUTE}]`);
    if (existing instanceof HTMLElement && existing.shadowRoot) {
      // A previous injection already mounted the shell in this frame (e.g. a
      // duplicate chrome.scripting.executeScript call) — reuse the live DOM
      // instead of creating a second overlapping host.
      this.host = existing;
      this.shadow = existing.shadowRoot;
      this.fabButton = this.shadow.querySelector<HTMLButtonElement>(".fab");
      this.drawerEl = this.shadow.querySelector<HTMLElement>(".drawer");
      this.frameEl = this.shadow.querySelector<HTMLIFrameElement>(".drawer-frame");
      this.bindGlobalListeners();
      return;
    }

    this.host = document.createElement("div");
    this.host.setAttribute(HOST_ATTRIBUTE, "true");
    this.shadow = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = SHELL_STYLES;
    this.shadow.appendChild(style);

    this.fabButton = this.buildFabButton();
    this.drawerEl = this.buildDrawer();

    this.shadow.append(this.fabButton, this.drawerEl);
    anchor.appendChild(this.host);

    this.bindGlobalListeners();
  }

  isExpanded(): boolean {
    return this.expanded;
  }

  expand(): void {
    if (!this.host) this.mount();
    this.expanded = true;
    if (this.drawerEl) this.drawerEl.hidden = false;
    if (this.fabButton) this.fabButton.hidden = true;
    void setPanelExpanded(true);
  }

  collapse(): void {
    this.expanded = false;
    if (this.drawerEl) this.drawerEl.hidden = true;
    if (this.fabButton) this.fabButton.hidden = false;
    void setPanelExpanded(false);
  }

  toggle(): void {
    if (this.expanded) this.collapse();
    else this.expand();
  }

  /** Applies the last persisted expand/collapse state for this session. */
  async restorePersistedState(): Promise<void> {
    const shouldExpand = await getPanelExpanded();
    if (shouldExpand) this.expand();
  }

  destroy(): void {
    document.removeEventListener("click", this.onDocumentClick, true);
    document.removeEventListener("keydown", this.onDocumentKeydown);
    this.listenersBound = false;
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.fabButton = null;
    this.drawerEl = null;
    this.frameEl = null;
    this.expanded = false;
  }

  private bindGlobalListeners(): void {
    if (this.listenersBound) return;
    // Capture phase so a page's stopPropagation() on bubbling click handlers
    // cannot suppress the outside-click collapse.
    document.addEventListener("click", this.onDocumentClick, true);
    document.addEventListener("keydown", this.onDocumentKeydown);
    this.listenersBound = true;
  }

  private buildFabButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fab";
    button.setAttribute("aria-label", "Open Flint");
    const icon = document.createElement("img");
    icon.src = chrome.runtime.getURL("icons/icon48.png");
    icon.alt = "Flint";
    button.appendChild(icon);
    button.addEventListener("click", () => this.expand());
    return button;
  }

  private buildDrawer(): HTMLElement {
    const drawer = document.createElement("div");
    drawer.className = "drawer";
    drawer.hidden = true;

    const header = document.createElement("div");
    header.className = "drawer-header";

    const title = document.createElement("div");
    title.className = "drawer-title";
    const titleIcon = document.createElement("img");
    titleIcon.src = chrome.runtime.getURL("icons/icon48.png");
    titleIcon.alt = "";
    const titleText = document.createElement("span");
    titleText.textContent = "Flint";
    title.append(titleIcon, titleText);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "drawer-close";
    closeButton.setAttribute("aria-label", "Close Flint panel");
    closeButton.textContent = "\u00d7";
    closeButton.addEventListener("click", () => this.collapse());

    header.append(title, closeButton);

    this.frameEl = document.createElement("iframe");
    this.frameEl.className = "drawer-frame";
    this.frameEl.src = chrome.runtime.getURL("popup/index.html");
    this.frameEl.title = "Flint Resume";

    drawer.append(header, this.frameEl);
    return drawer;
  }
}
