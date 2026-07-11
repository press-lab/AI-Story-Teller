import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

const usage = `Usage: node scripts/full-ui-visual-audit.mjs [base-url] [options]

Options:
  --base-url <url>   App URL to audit (default: http://127.0.0.1:5173/)
  --output <path>    Write screenshots and report.json to this durable directory
  --theme <name>     Force light or dark theme before capture (default: light)
  --help             Show this help

The app must be running in Browser Local fixture mode, or already expose an
authenticated product shell with the built-in Arcane scenario available.`;

function parseArgs(args) {
  let baseUrl = "http://127.0.0.1:5173/";
  let outputDir;
  let theme = "light";
  let positionalBaseUrlSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { help: true, baseUrl, outputDir };
    if (argument === "--base-url") {
      const value = args[index + 1];
      if (!value) throw new Error("--base-url requires a URL.");
      baseUrl = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--base-url=")) {
      baseUrl = argument.slice("--base-url=".length);
      continue;
    }
    if (argument === "--output") {
      const value = args[index + 1];
      if (!value) throw new Error("--output requires a directory path.");
      outputDir = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--output=")) {
      outputDir = argument.slice("--output=".length);
      continue;
    }
    if (argument === "--theme") {
      const value = args[index + 1];
      if (value !== "light" && value !== "dark") throw new Error("--theme requires light or dark.");
      theme = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--theme=")) {
      const value = argument.slice("--theme=".length);
      if (value !== "light" && value !== "dark") throw new Error("--theme requires light or dark.");
      theme = value;
      continue;
    }
    if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    if (positionalBaseUrlSeen) throw new Error(`Unexpected argument: ${argument}`);
    baseUrl = argument;
    positionalBaseUrlSeen = true;
  }

  return { help: false, baseUrl, outputDir, theme };
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(usage);
  process.exit(0);
}

const baseUrl = options.baseUrl;
const viewports = [
  { name: "desktop-1280x720", width: 1280, height: 720, mobile: false },
  { name: "desktop-1440x900", width: 1440, height: 900, mobile: false },
  { name: "desktop-1920x1080", width: 1920, height: 1080, mobile: false },
  { name: "mobile-320x568", width: 320, height: 568, mobile: true },
  { name: "mobile-390x844", width: 390, height: 844, mobile: true },
];

function browserPath() {
  return [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find(existsSync);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitForJson(url, timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Browser startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() { this.ws.close(); }
}

async function main() {
  const executablePath = browserPath();
  if (!executablePath) throw new Error("Could not find Chrome or Edge.");

  const port = await freePort();
  const profileDir = await mkdtemp(path.join(tmpdir(), "story-mode-ai-audit-profile-"));
  const auditDir = options.outputDir
    ? path.resolve(process.cwd(), options.outputDir)
    : await mkdtemp(path.join(tmpdir(), "story-mode-ai-full-ui-audit-"));
  await mkdir(auditDir, { recursive: true });
  const chrome = spawn(executablePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-extensions",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  let cdp;
  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    const targets = await waitForJson(`http://127.0.0.1:${port}/json`);
    const pageTarget = targets.find((target) => target.type === "page");
    if (!pageTarget?.webSocketDebuggerUrl) throw new Error("Could not find browser page target.");
    cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    const evaluate = async (fn, arg) => {
      const result = await cdp.send("Runtime.evaluate", {
        expression: `(${fn.toString()})(${JSON.stringify(arg ?? null)})`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
      return result.result.value;
    };
    const wait = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitForCondition = async (fn, arg, description, timeoutMs = 12_000) => {
      const started = Date.now();
      let lastValue;
      while (Date.now() - started < timeoutMs) {
        lastValue = await evaluate(fn, arg);
        if (lastValue) return lastValue;
        await wait(100);
      }
      throw new Error(`Timed out waiting for ${description}. Last value: ${JSON.stringify(lastValue)}`);
    };

    const settleUi = async () => {
      await evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await wait(80);
    };

    const waitForProductShell = async () => {
      await waitForCondition(
        () => document.readyState === "complete"
          && Boolean(document.querySelector(".app-shell .product-rail-nav"))
          && Boolean(document.querySelector(".app-shell .mobile-bottom-nav")),
        undefined,
        "the product shell (run the app in Browser Local fixture mode or sign in first)",
      );
      await settleUi();
    };

    const clickExact = async (label, scope = "document") => {
      await waitForCondition(({ label, scope }) => {
        const root = scope === "document" ? document : document.querySelector(scope);
        if (!root) return false;
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        };
        const matches = [...root.querySelectorAll("button")].filter((button) => {
          const text = (button.textContent || "").replace(/\s+/g, " ").trim();
          return visible(button) && (text === label || button.getAttribute("aria-label") === label);
        });
        return matches.length === 1;
      }, { label, scope }, `one visible “${label}” button in ${scope}`);
      await evaluate(({ label, scope }) => {
        const root = scope === "document" ? document : document.querySelector(scope);
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        };
        const button = [...root.querySelectorAll("button")].find((item) => {
          const text = (item.textContent || "").replace(/\s+/g, " ").trim();
          return visible(item) && (text === label || item.getAttribute("aria-label") === label);
        });
        button.click();
      }, { label, scope });
      await settleUi();
    };

    const clickFirst = async (selector, description = selector) => {
      await waitForCondition((value) => {
        const element = document.querySelector(value);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }, selector, description);
      await evaluate((value) => document.querySelector(value).click(), selector);
      await settleUi();
    };

    const ensureDetailsOpen = async (selector) => {
      const isOpen = await waitForCondition((value) => Boolean(document.querySelector(value)), selector, selector);
      if (!isOpen) return;
      const open = await evaluate((value) => document.querySelector(value).open, selector);
      if (!open) await clickFirst(`${selector} > summary`, `${selector} summary`);
    };

    const ensureDesktopStory = async () => {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await cdp.send("Page.navigate", { url: baseUrl });
      await waitForProductShell();
      const hasStory = await evaluate(() => !document.querySelector('.product-rail-nav button[disabled]') &&
        [...document.querySelectorAll(".product-rail-nav button")].some((button) => button.textContent?.trim() === "Play"));
      if (hasStory) return;
      await clickExact("Explore", ".product-rail-nav");
      await waitForCondition(() => Boolean([...document.querySelectorAll("button")].find((item) =>
        item.getAttribute("aria-label") === "View details for Arcane: After the Rocket")), undefined, "the Arcane fixture scenario");
      await evaluate(() => {
        const button = [...document.querySelectorAll("button")].find((item) => item.getAttribute("aria-label") === "View details for Arcane: After the Rocket");
        button.click();
      });
      await settleUi();
      await clickExact("Start Story");
      await waitForCondition(() => {
        const play = [...document.querySelectorAll(".product-rail-nav button")]
          .find((button) => button.textContent?.trim() === "Play");
        return Boolean(play && !play.disabled);
      }, undefined, "the Arcane fixture Story to open");
      await settleUi();
    };

    await ensureDesktopStory();
    const darkModeEnabled = await evaluate(() => document.documentElement.classList.contains("dark-mode"));
    if ((options.theme === "dark") !== darkModeEnabled) {
      await clickExact(options.theme === "dark" ? "Use dark theme" : "Use light theme");
    }
    const results = [];

    const auditCurrentScreen = async (viewportName, screenName, preserveScroll = false) => {
      if (!preserveScroll) await evaluate(() => {
        window.scrollTo(0, 0);
        for (const element of document.querySelectorAll(".main-content,.editor-body,.transcript,.play-sidebar-panel-body")) element.scrollTop = 0;
      });
      await settleUi();
      const metrics = await evaluate(({ viewportName, screenName }) => {
        const viewport = { width: innerWidth, height: innerHeight };
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0.01) return false;
          if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return false;
          const x = Math.max(0, Math.min(innerWidth - 1, rect.left + Math.min(rect.width / 2, 8)));
          const y = Math.max(0, Math.min(innerHeight - 1, rect.top + Math.min(rect.height / 2, 8)));
          const topElement = document.elementFromPoint(x, y);
          return !topElement || element.contains(topElement);
        };
        const selector = (element) => {
          if (element.id) return `${element.tagName.toLowerCase()}#${element.id}`;
          const classes = String(element.className || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
          return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
        };
        const interactive = [...document.querySelectorAll("button,input,select,textarea,summary,[role=button]")].filter(visible);
        const protrusions = [];
        const clippedText = [];
        const tinyTargets = [];
        const overlaps = [];
        for (const element of document.querySelectorAll("body *")) {
          if (!visible(element)) continue;
          const rect = element.getBoundingClientRect();
          if (rect.bottom < 0 || rect.top > viewport.height) continue;
          if (rect.left < -2 || rect.right > viewport.width + 2) protrusions.push({ selector: selector(element), left: Math.round(rect.left), right: Math.round(rect.right) });
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();
          const style = getComputedStyle(element);
          if (element.children.length === 0 && text.length > 18 && element.scrollWidth - element.clientWidth > 2 && !["auto", "scroll"].includes(style.overflowX) && style.textOverflow !== "ellipsis") {
            clippedText.push({ selector: selector(element), text: text.slice(0, 80), delta: element.scrollWidth - element.clientWidth });
          }
        }
        const minimumTarget = viewportName.startsWith("mobile-") ? 44 : 24;
        for (const element of interactive) {
          const rect = element.getBoundingClientRect();
          const tag = element.tagName.toLowerCase();
          const nativeSmall = tag === "input" && ["checkbox", "radio", "range"].includes(element.type);
          if (!nativeSmall && (rect.width < minimumTarget || rect.height < minimumTarget)) tinyTargets.push({ selector: selector(element), width: Math.round(rect.width), height: Math.round(rect.height), expected: minimumTarget });
        }
        for (let index = 0; index < interactive.length; index += 1) {
          const first = interactive[index].getBoundingClientRect();
          if (first.bottom < 0 || first.top > viewport.height) continue;
          for (let next = index + 1; next < interactive.length; next += 1) {
            const second = interactive[next].getBoundingClientRect();
            const width = Math.min(first.right, second.right) - Math.max(first.left, second.left);
            const height = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
            const deliberateOverlay = interactive[index].closest(".mobile-bottom-nav,.mobile-more-backdrop,.toast-stack,.composer-input-row") ||
              interactive[next].closest(".mobile-bottom-nav,.mobile-more-backdrop,.toast-stack,.composer-input-row");
            if (width > 3 && height > 3 && !deliberateOverlay && !interactive[index].contains(interactive[next]) && !interactive[next].contains(interactive[index])) {
              overlaps.push({
                first: selector(interactive[index]),
                firstText: (interactive[index].textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
                second: selector(interactive[next]),
                secondText: (interactive[next].textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
                width: Math.round(width),
                height: Math.round(height),
              });
            }
          }
        }
        const headings = [...document.querySelectorAll("h1,h2,h3,h4")].filter(visible).map((heading) => ({
          selector: selector(heading),
          text: heading.textContent?.trim().slice(0, 70),
          size: Number.parseFloat(getComputedStyle(heading).fontSize),
          family: getComputedStyle(heading).fontFamily,
        }));
        const oversizedEmptyCards = [...document.querySelectorAll(".library-card-body,.profile-connection-card-body,.panel,.card")]
          .filter(visible)
          .map((element) => ({ element, rect: element.getBoundingClientRect(), text: (element.textContent || "").replace(/\s+/g, " ").trim() }))
          .filter(({ rect, text }) => rect.height > 180 && text.length < 40)
          .map(({ element, rect, text }) => ({ selector: selector(element), height: Math.round(rect.height), text }));
        return {
          viewportName,
          screenName,
          viewport,
          heading: document.querySelector("h1")?.textContent?.trim() || document.querySelector("h2")?.textContent?.trim() || "",
          documentOverflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
          protrusions: protrusions.slice(0, 12),
          clippedText: clippedText.slice(0, 12),
          tinyTargets: tinyTargets.slice(0, 12),
          overlaps: overlaps.slice(0, 12),
          headings,
          oversizedEmptyCards,
        };
      }, { viewportName, screenName });
      const failures = [];
      if (metrics.documentOverflowX > 2) failures.push(`document overflow ${metrics.documentOverflowX}px`);
      if (metrics.protrusions.length) failures.push(`${metrics.protrusions.length} viewport protrusions`);
      if (metrics.clippedText.length) failures.push(`${metrics.clippedText.length} clipped text elements`);
      if (metrics.tinyTargets.length) failures.push(`${metrics.tinyTargets.length} controls below ${viewportName.startsWith("mobile-") ? 44 : 24}px`);
      if (metrics.overlaps.length) failures.push(`${metrics.overlaps.length} overlapping controls`);
      if (metrics.oversizedEmptyCards.length) failures.push(`${metrics.oversizedEmptyCards.length} oversized empty cards`);
      const slug = `${viewportName}--${screenName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const capture = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      const screenshotPath = path.join(auditDir, `${String(results.length + 1).padStart(3, "0")}--${slug}.png`);
      await writeFile(screenshotPath, Buffer.from(capture.data, "base64"));
      results.push({ ...metrics, failures, screenshotPath });
    };

    const rail = async (label) => clickExact(label, ".product-rail-nav");
    const studioTab = async (label) => clickExact(label, ".editor-tabs");
    const mobileNav = async (label) => clickExact(label, ".mobile-bottom-nav");

    const auditNewStory = async (viewportName) => {
      await clickExact("New Story");
      await auditCurrentScreen(viewportName, "New Story setup");
    };

    const auditStudioItemEditor = async (viewportName) => {
      await studioTab("Story & Direction");
      const summarySelector = ".editor-body .components-page summary[aria-label=\"Edit Author's Note\"]";
      await evaluate((selector) => document.querySelector(selector)?.scrollIntoView({ block: "center" }), summarySelector);
      await settleUi();
      await clickFirst(summarySelector, "the first World Block editor row");
      await waitForCondition(() => Boolean(document.querySelector(".editor-body .components-page details.component-editor-item[open] > summary[aria-label^=\"Back to\"]")), undefined, "an open World Block editor");
      await evaluate(() => document.querySelector(".editor-body .components-page details.component-editor-item[open] > summary")?.scrollIntoView({ block: "start" }));
      await settleUi();
      await auditCurrentScreen(viewportName, "Story Studio - opened World Block editor", true);
    };

    const openAdvancedStudioTool = async (label) => {
      await ensureDetailsOpen("details.studio-advanced-tools");
      await clickExact(label, ".studio-advanced-tool-actions");
    };

    const auditDesktopViewport = async (viewportName) => {
      await rail("Home");
      await auditCurrentScreen(viewportName, "Home");
      await auditNewStory(viewportName);

      await rail("Explore");
      await auditCurrentScreen(viewportName, "Explore");

      await rail("Play");
      const companionCollapsed = await evaluate(() => Boolean(document.querySelector('.play-toolkit-expand')));
      if (!companionCollapsed) await clickExact("Collapse story companion");
      await auditCurrentScreen(viewportName, "Play - companion collapsed");
      await clickExact("Show story companion");
      await auditCurrentScreen(viewportName, "Play - companion open");
      await clickExact("Shape the story", ".play-tool-nav");
      await auditCurrentScreen(viewportName, "Play - companion editor");

      await rail("Story Studio");
      await auditCurrentScreen(viewportName, "Story Studio");
      await auditStudioItemEditor(viewportName);
      for (const label of ["Story & Direction", "World & Lore", "Characters", "Suggestions"]) {
        await studioTab(label);
        await auditCurrentScreen(viewportName, `Story Studio - ${label}`);
      }

      await rail("Story Studio");
      await openAdvancedStudioTool("Automation");
      await auditCurrentScreen(viewportName, "Story Studio - Automation");
      await rail("Story Studio");
      await openAdvancedStudioTool("Context Inspector");
      await auditCurrentScreen(viewportName, "Story Studio - Context Inspector");

      for (const label of ["History", "Backups & Transfer", "Settings", "Help"]) {
        await rail(label);
        await auditCurrentScreen(viewportName, label);
      }
    };

    const auditMobileViewport = async (viewportName) => {
      await mobileNav("Home");
      await auditCurrentScreen(viewportName, "Home");
      await auditNewStory(viewportName);

      await mobileNav("Explore");
      await auditCurrentScreen(viewportName, "Explore");

      await mobileNav("Play");
      await auditCurrentScreen(viewportName, "Play");
      await clickExact("Story companion", ".mobile-story-tools-bar");
      await auditCurrentScreen(viewportName, "Play - Story companion destinations");
      await clickExact("Shape the story", ".mobile-story-tools-sheet");
      await auditCurrentScreen(viewportName, "Play - selected Story companion tool");
      await clickExact("Close selected tool", ".mobile-story-tools-sheet");
      await clickExact("Close", ".mobile-story-tools-sheet");

      await mobileNav("Studio");
      await auditCurrentScreen(viewportName, "Story Studio");
      await auditStudioItemEditor(viewportName);
      for (const label of ["Story & Direction", "World & Lore", "Characters", "Suggestions"]) {
        await studioTab(label);
        await auditCurrentScreen(viewportName, `Story Studio - ${label}`);
      }

      await mobileNav("Studio");
      await openAdvancedStudioTool("Automation");
      await auditCurrentScreen(viewportName, "Story Studio - Automation");
      await mobileNav("Studio");
      await openAdvancedStudioTool("Context Inspector");
      await auditCurrentScreen(viewportName, "Story Studio - Context Inspector");

      await mobileNav("More");
      await auditCurrentScreen(viewportName, "More menu");
      for (const label of ["History", "Backups & Transfer", "Settings", "Help"]) {
        await clickExact(label, ".mobile-more-sheet");
        await auditCurrentScreen(viewportName, label);
        await mobileNav("More");
      }
    };

    for (const viewport of viewports) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.mobile,
      });
      await settleUi();
      if (viewport.mobile) await auditMobileViewport(viewport.name);
      else await auditDesktopViewport(viewport.name);
    }

    const reportPath = path.join(auditDir, "report.json");
    const failed = results.filter((result) => result.failures.length > 0);
    await writeFile(reportPath, JSON.stringify({
      baseUrl,
      generatedAt: new Date().toISOString(),
      durableOutput: Boolean(options.outputDir),
      theme: options.theme,
      auditDir,
      viewports,
      results,
    }, null, 2));
    console.log(JSON.stringify({
      auditDir,
      reportPath,
      durableOutput: Boolean(options.outputDir),
      theme: options.theme,
      viewports: viewports.map(({ name, width, height }) => ({ name, width, height })),
      screens: results.length,
      failedScreens: failed.map((item) => ({ screen: `${item.viewportName}: ${item.screenName}`, failures: item.failures })),
    }, null, 2));
    if (failed.length) process.exitCode = 1;
  } finally {
    cdp?.close();
    chrome.kill();
    await new Promise((resolve) => setTimeout(resolve, 250));
    await rm(profileDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
