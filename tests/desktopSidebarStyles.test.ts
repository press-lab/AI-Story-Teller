import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop play sidebar layout contract", () => {
  it("keeps compact editor summaries inside the desktop play panel", () => {
    const css = readFileSync(resolve("src/styles.css"), "utf8");
    const desktopCss = css.split("@media (max-width: 860px)")[0] ?? "";

    expect(desktopCss).toMatch(/\.play-sidebar-panel-body\s*{[^}]*overflow-x:\s*hidden/s);
    expect(desktopCss).toMatch(
      /\.play-sidebar-panel-body \.story-card-summary,\s*\n\.play-sidebar-panel-body \.proposal-card-summary,\s*\n\.play-sidebar-panel-body \.trigger-rule-summary\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
    expect(desktopCss).toMatch(
      /\.play-sidebar-panel-body \.split-editor-item\[open\] > summary \.story-card-summary,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
    expect(desktopCss).toMatch(
      /\.play-sidebar-panel-body \.story-card-title,\s*\n\.play-sidebar-panel-body \.story-card-keys,\s*\n\.play-sidebar-panel-body \.story-card-summary \.search-snippet\s*{[^}]*white-space:\s*normal/s,
    );
    expect(desktopCss).toMatch(
      /\.play-sidebar-panel-body \.editor-surface input,\s*\n\.play-sidebar-panel-body \.editor-surface select,\s*\n\.play-sidebar-panel-body \.editor-surface textarea,\s*\n\.play-sidebar-panel-body \.editor-surface button\s*{[^}]*max-width:\s*100%/s,
    );
  });
});
