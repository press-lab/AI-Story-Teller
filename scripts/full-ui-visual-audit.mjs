import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173/";
const viewports = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
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
  const auditDir = await mkdtemp(path.join(tmpdir(), "story-mode-ai-full-ui-audit-"));
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
    const wait = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

    const clickExact = async (label, scope = "document") => {
      const result = await evaluate(({ label, scope }) => {
        const root = scope === "document" ? document : document.querySelector(scope);
        if (!root) return { ok: false, reason: `missing scope ${scope}` };
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        };
        const matches = [...root.querySelectorAll("button")].filter((button) =>
          visible(button) && (button.textContent || "").replace(/\s+/g, " ").trim() === label,
        );
        if (matches.length !== 1) return { ok: false, reason: `${matches.length} matches`, labels: matches.map((item) => item.textContent?.trim()) };
        matches[0].click();
        return { ok: true };
      }, { label, scope });
      if (!result.ok) throw new Error(`Could not click ${label}: ${result.reason} ${JSON.stringify(result.labels ?? [])}`);
      await wait();
    };

    const ensureDesktopStory = async () => {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await cdp.send("Page.navigate", { url: baseUrl });
      await wait(900);
      const hasStory = await evaluate(() => !document.querySelector('.product-rail-nav button[disabled]') &&
        [...document.querySelectorAll(".product-rail-nav button")].some((button) => button.textContent?.trim() === "Play"));
      if (hasStory) return;
      await clickExact("Explore", ".product-rail-nav");
      const opened = await evaluate(() => {
        const button = [...document.querySelectorAll("button")].find((item) => item.getAttribute("aria-label") === "View details for Arcane: After the Rocket");
        button?.click();
        return Boolean(button);
      });
      if (!opened) throw new Error("Arcane scenario details button was not found.");
      await wait();
      await clickExact("Start Story");
      await wait(600);
    };

    await ensureDesktopStory();
    const results = [];

    const auditCurrentScreen = async (viewportName, screenName) => {
      await evaluate(() => {
        window.scrollTo(0, 0);
        for (const element of document.querySelectorAll(".main-content,.transcript,.play-sidebar-panel-body")) element.scrollTop = 0;
      });
      await wait(120);
      const metrics = await evaluate(({ viewportName, screenName }) => {
        const viewport = { width: innerWidth, height: innerHeight };
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0.01) return false;
          const x = Math.max(0, Math.min(innerWidth - 1, rect.left + Math.min(rect.width / 2, 8)));
          const y = Math.max(0, Math.min(innerHeight - 1, rect.top + Math.min(rect.height / 2, 8)));
          const topElement = document.elementFromPoint(x, y);
          return !topElement || element.contains(topElement) || topElement.contains(element);
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
        for (const element of interactive) {
          const rect = element.getBoundingClientRect();
          const tag = element.tagName.toLowerCase();
          const nativeSmall = tag === "input" && ["checkbox", "radio", "range"].includes(element.type);
          if (!nativeSmall && (rect.width < 24 || rect.height < 24)) tinyTargets.push({ selector: selector(element), width: Math.round(rect.width), height: Math.round(rect.height) });
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
      if (metrics.tinyTargets.length) failures.push(`${metrics.tinyTargets.length} controls below 24px`);
      if (metrics.overlaps.length) failures.push(`${metrics.overlaps.length} overlapping controls`);
      if (metrics.oversizedEmptyCards.length) failures.push(`${metrics.oversizedEmptyCards.length} oversized empty cards`);
      const slug = `${viewportName}-${screenName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const capture = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      const screenshotPath = path.join(auditDir, `${String(results.length + 1).padStart(2, "0")}-${slug}.png`);
      await writeFile(screenshotPath, Buffer.from(capture.data, "base64"));
      results.push({ ...metrics, failures, screenshotPath });
    };

    const rail = async (label) => clickExact(label, ".product-rail-nav");
    const studioTab = async (label) => clickExact(label, ".editor-tabs");
    for (const viewport of viewports) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.mobile,
      });
      await wait(250);
      if (viewport.mobile) {
        const mobilePages = ["Home", "Explore", "Play", "Studio"];
        for (const label of mobilePages) {
          await clickExact(label, ".mobile-bottom-nav");
          await auditCurrentScreen(viewport.name, label === "Studio" ? "Story Studio" : label);
        }
        await clickExact("More", ".mobile-bottom-nav");
        await auditCurrentScreen(viewport.name, "More menu");
        for (const label of ["History", "Backups & Transfer", "Settings", "Help"]) {
          await clickExact(label, ".mobile-more-sheet");
          await auditCurrentScreen(viewport.name, label);
          await clickExact("More", ".mobile-bottom-nav");
        }
      } else {
        for (const label of ["Home", "Explore", "Play", "Story Studio"]) {
          await rail(label);
          await auditCurrentScreen(viewport.name, label);
        }
        for (const label of ["Story & Direction", "World & Lore", "Characters", "Suggestions"]) {
          await studioTab(label);
          await auditCurrentScreen(viewport.name, `Story Studio - ${label}`);
        }
        for (const label of ["History", "Backups & Transfer", "Settings", "Help"]) {
          await clickExact(label, ".product-rail-nav");
          await auditCurrentScreen(viewport.name, label);
        }
      }
    }

    const reportPath = path.join(auditDir, "report.json");
    const failed = results.filter((result) => result.failures.length > 0);
    await writeFile(reportPath, JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results }, null, 2));
    console.log(JSON.stringify({ auditDir, reportPath, screens: results.length, failedScreens: failed.map((item) => ({ screen: `${item.viewportName}: ${item.screenName}`, failures: item.failures })) }, null, 2));
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
