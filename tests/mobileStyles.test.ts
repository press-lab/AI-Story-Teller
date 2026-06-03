import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("mobile layout contract", () => {
  it("declares a viewport that supports phone safe-area rendering", () => {
    const html = readProjectFile("index.html");

    expect(html).toContain("width=device-width");
    expect(html).toContain("viewport-fit=cover");
  });

  it("switches phones to a dedicated mobile shell with wrapped top navigation", () => {
    const css = readProjectFile("src/styles.css");
    const mobileBlock = css.match(/@media \(max-width: 640px\) \{[\s\S]*$/)?.[0] ?? "";

    expect(mobileBlock).toContain("height: 100dvh");
    expect(mobileBlock).toMatch(/\.app-shell\s*{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/s);
    expect(mobileBlock).toMatch(/\.app-nav\s*{[^}]*overflow-x:\s*auto/s);
    expect(mobileBlock).toMatch(/button\s*{[^}]*min-height:\s*44px/s);
  });

  it("keeps the mobile play composer touch-sized and available while reading the story", () => {
    const css = readProjectFile("src/styles.css");
    const mobileBlock = css.match(/@media \(max-width: 640px\) \{[\s\S]*$/)?.[0] ?? "";

    expect(mobileBlock).toMatch(/input,\s*\n\s*select,\s*\n\s*textarea\s*{[^}]*font-size:\s*16px/s);
    // position:relative (not sticky) avoids iOS Safari overflow-containment horizontal scroll
    expect(mobileBlock).toMatch(/\.composer\s*{[^}]*position:\s*relative/s);
    expect(mobileBlock).toMatch(/\.composer-actions\s*{[^}]*overflow-x:\s*auto/s);
    expect(mobileBlock).toMatch(/\.tool-modal\s*{[^}]*height:\s*100dvh/s);
  });
});
