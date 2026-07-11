import {
  clientNetworkMetadata,
  createClientTraceId,
  recordClientPerformanceTrace,
  submitClientPerformanceTrace,
  type ClientPerformanceTrace,
} from "./performanceTrace";
import {
  applyConfiguredBackendDefault,
  defaultRuntimeConfig,
  type RuntimeConfig,
} from "./runtimeConfig";

const RUNTIME_CONFIG_STORAGE_KEY = "ai-story-teller-runtime-config";
const LONG_TASK_FLUSH_MS = 30_000;

const NAVIGATION_DESTINATIONS: Record<string, string> = {
  Home: "home",
  Explore: "explore",
  Play: "play",
  "Story Studio": "story-studio",
  History: "history",
  "Backups & Transfer": "backups-transfer",
  Automation: "automation",
  "Context Inspector": "context-inspector",
  Settings: "settings",
  Help: "help",
  Admin: "admin",
};

interface NavigationTimingLike {
  startTime?: number;
  responseStart?: number;
  responseEnd?: number;
  domInteractive?: number;
  domContentLoadedEventEnd?: number;
  loadEventEnd?: number;
  transferSize?: number;
  type?: string;
}

export interface PageLoadMeasurement {
  durationMs: number;
  metadata: Record<string, string | number | boolean | undefined>;
}

export function readClientPerformanceRuntimeConfig(storage: Pick<Storage, "getItem"> = localStorage): RuntimeConfig {
  try {
    const saved = JSON.parse(storage.getItem(RUNTIME_CONFIG_STORAGE_KEY) ?? "null") as Partial<RuntimeConfig> | null;
    return applyConfiguredBackendDefault(saved ?? defaultRuntimeConfig);
  } catch {
    return defaultRuntimeConfig;
  }
}

export function measurePageLoad(
  timing: NavigationTimingLike,
  resourceCount: number,
  now = performance.now(),
): PageLoadMeasurement {
  const start = finiteNonNegative(timing.startTime) ?? 0;
  const responseStart = finiteNonNegative(timing.responseStart) ?? start;
  const responseEnd = finiteNonNegative(timing.responseEnd) ?? responseStart;
  const domInteractive = finiteNonNegative(timing.domInteractive) ?? responseEnd;
  const domContentLoaded = finiteNonNegative(timing.domContentLoadedEventEnd) ?? domInteractive;
  const end = finiteNonNegative(timing.loadEventEnd) || Math.max(domContentLoaded, now);
  const ttfbMs = Math.max(0, Math.round(responseStart - start));
  const clientWorkMs = Math.max(0, Math.round(end - responseEnd));
  const durationMs = Math.max(0, Math.round(end - start));
  const causeHint = classifyPageLoadCause(ttfbMs, clientWorkMs, durationMs);
  return {
    durationMs,
    metadata: {
      navigationType: typeof timing.type === "string" ? timing.type : undefined,
      ttfbMs,
      responseDownloadMs: Math.max(0, Math.round(responseEnd - responseStart)),
      domInteractiveMs: Math.max(0, Math.round(domInteractive - start)),
      domContentLoadedMs: Math.max(0, Math.round(domContentLoaded - start)),
      clientWorkMs,
      transferBytes: finiteNonNegative(timing.transferSize),
      resourceCount: Math.max(0, Math.round(resourceCount)),
      causeHint,
    },
  };
}

export function classifyPageLoadCause(ttfbMs: number, clientWorkMs: number, totalMs: number): string | undefined {
  if (ttfbMs >= 1_000 && ttfbMs >= clientWorkMs) return "server_or_network";
  if (clientWorkMs >= 1_000) return "client_render_or_assets";
  if (totalMs >= 2_500) return "mixed_page_load";
  return undefined;
}

export function navigationDestination(label: string): string | undefined {
  return NAVIGATION_DESTINATIONS[label.trim()];
}

export function startClientPerformanceMonitoring(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => undefined;

  let stopped = false;
  let largestContentfulPaintMs = 0;
  let worstInteractionMs = 0;
  let interactionCount = 0;
  let longTaskCount = 0;
  let longTaskTotalMs = 0;
  let longestTaskMs = 0;
  const observers: PerformanceObserver[] = [];

  const report = (
    phase: string,
    durationMs: number,
    route: string,
    metadata: ClientPerformanceTrace["metadata"] = {},
  ) => {
    if (stopped || !Number.isFinite(durationMs) || durationMs < 0) return;
    const traceId = createClientTraceId();
    const trace: ClientPerformanceTrace = {
      id: `client_${traceId}`,
      traceId,
      source: "device",
      phase,
      route,
      method: "UI",
      status: "ok",
      durationMs: Math.round(durationMs),
      metadata: { ...clientNetworkMetadata(), ...metadata },
      createdAt: new Date().toISOString(),
    };
    recordClientPerformanceTrace(trace);
    const config = readClientPerformanceRuntimeConfig();
    if (config.mode !== "local") submitClientPerformanceTrace(config, trace);
  };

  const reportPageLoad = () => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!navigation) return;
    const measurement = measurePageLoad(
      navigation,
      performance.getEntriesByType("resource").length,
    );
    report("page_load", measurement.durationMs, "/app", measurement.metadata);
  };

  if (document.readyState === "complete") window.setTimeout(reportPageLoad, 0);
  else window.addEventListener("load", reportPageLoad, { once: true });

  const navigationClick = (event: MouseEvent) => {
    const element = event.target instanceof Element ? event.target.closest("nav button") : null;
    if (!(element instanceof HTMLButtonElement) || element.disabled) return;
    const label = element.getAttribute("aria-label")?.trim() || element.textContent?.trim() || "";
    const destination = navigationDestination(label);
    if (!destination) return;
    const startedAt = performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const durationMs = Math.max(0, performance.now() - startedAt);
      report("ui_navigation", durationMs, `/ui/${destination}`, {
        destination,
        causeHint: durationMs >= 200 ? "client_render" : undefined,
      });
    }));
  };
  document.addEventListener("click", navigationClick, { capture: true });

  observe("largest-contentful-paint", (entries) => {
    for (const entry of entries) largestContentfulPaintMs = Math.max(largestContentfulPaintMs, entry.startTime);
  }, true);
  observe("event", (entries) => {
    for (const entry of entries) {
      if (entry.duration <= 0) continue;
      interactionCount += 1;
      worstInteractionMs = Math.max(worstInteractionMs, entry.duration);
    }
  }, true, 40);
  observe("longtask", (entries) => {
    for (const entry of entries) {
      longTaskCount += 1;
      longTaskTotalMs += entry.duration;
      longestTaskMs = Math.max(longestTaskMs, entry.duration);
    }
  });

  function observe(type: string, onEntries: (entries: PerformanceEntry[]) => void, buffered = false, durationThreshold?: number) {
    if (typeof PerformanceObserver === "undefined") return;
    try {
      const observer = new PerformanceObserver((list) => onEntries(list.getEntries()));
      observer.observe({ type, buffered, ...(durationThreshold ? { durationThreshold } : {}) } as PerformanceObserverInit);
      observers.push(observer);
    } catch {
      // Not every browser implements every observer entry type.
    }
  }

  const flushLongTasks = () => {
    if (longTaskCount === 0) return;
    report("long_task_window", longTaskTotalMs, "/app", {
      taskCount: longTaskCount,
      longestTaskMs: Math.round(longestTaskMs),
      causeHint: "main_thread_work",
    });
    longTaskCount = 0;
    longTaskTotalMs = 0;
    longestTaskMs = 0;
  };
  const longTaskTimer = window.setInterval(flushLongTasks, LONG_TASK_FLUSH_MS);

  let finalVitalsReported = false;
  const reportFinalVitals = () => {
    if (finalVitalsReported) return;
    finalVitalsReported = true;
    if (largestContentfulPaintMs > 0) {
      report("largest_contentful_paint", largestContentfulPaintMs, "/app", {
        causeHint: largestContentfulPaintMs >= 2_500 ? "render_or_asset_loading" : undefined,
      });
    }
    if (worstInteractionMs > 0) {
      report("interaction_latency", worstInteractionMs, "/app", {
        interactionCount,
        causeHint: worstInteractionMs >= 200 ? "main_thread_work" : undefined,
      });
    }
    flushLongTasks();
  };
  const visibilityChange = () => {
    if (document.visibilityState === "hidden") reportFinalVitals();
  };
  document.addEventListener("visibilitychange", visibilityChange);
  window.addEventListener("pagehide", reportFinalVitals, { once: true });

  return () => {
    stopped = true;
    window.removeEventListener("load", reportPageLoad);
    document.removeEventListener("click", navigationClick, { capture: true });
    document.removeEventListener("visibilitychange", visibilityChange);
    window.removeEventListener("pagehide", reportFinalVitals);
    window.clearInterval(longTaskTimer);
    observers.forEach((observer) => observer.disconnect());
  };
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
