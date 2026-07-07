import { describe, expect, it } from "vitest";
import {
  applyConfiguredBackendDefault,
  isCloudflareQuickTunnelApiBaseUrl,
  isFallbackBackendApiBaseUrl,
  normalizeRuntimeConfig,
} from "./runtimeConfig";

describe("runtime config", () => {
  it("uses local backend as the default", () => {
    expect(normalizeRuntimeConfig(undefined)).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "http://127.0.0.1:8787",
    });
  });

  it("accepts explicit runtime modes", () => {
    expect(normalizeRuntimeConfig({ mode: "backendLocal", apiBaseUrl: "http://localhost:8787/" })).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "http://localhost:8787/",
    });
    expect(normalizeRuntimeConfig({ mode: "local" })).toEqual({
      mode: "local",
      apiBaseUrl: "http://127.0.0.1:8787",
    });
    expect(normalizeRuntimeConfig({ mode: "unexpected" as never })).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "http://127.0.0.1:8787",
    });
  });

  it("replaces the old browser-local backend URL with the configured owner server default", () => {
    expect(applyConfiguredBackendDefault(
      { mode: "backendLocal", apiBaseUrl: "http://127.0.0.1:8787" },
      { mode: "backendLocal", apiBaseUrl: "https://story-api.example.com" },
    )).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "https://story-api.example.com",
    });
  });

  it("keeps custom backend URLs instead of forcing the build default", () => {
    expect(applyConfiguredBackendDefault(
      { mode: "backendLocal", apiBaseUrl: "https://custom.example.com" },
      { mode: "backendLocal", apiBaseUrl: "https://story-api.example.com" },
    )).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "https://custom.example.com",
    });
  });

  it("replaces stale Cloudflare Quick Tunnel URLs with the configured owner server default", () => {
    expect(applyConfiguredBackendDefault(
      { mode: "backendLocal", apiBaseUrl: "https://old-tunnel.trycloudflare.com" },
      { mode: "backendLocal", apiBaseUrl: "https://new-tunnel.trycloudflare.com" },
    )).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "https://new-tunnel.trycloudflare.com",
    });
  });

  it("replaces stale Cloudflare Quick Tunnel URLs when the configured default becomes stable", () => {
    expect(applyConfiguredBackendDefault(
      { mode: "backendLocal", apiBaseUrl: "https://old-tunnel.trycloudflare.com/" },
      { mode: "hostedBackend", apiBaseUrl: "https://api.storymodeai.com" },
    )).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "https://api.storymodeai.com",
    });
  });

  it("recognizes the legacy localhost API default with or without a trailing slash", () => {
    expect(isFallbackBackendApiBaseUrl("http://127.0.0.1:8787")).toBe(true);
    expect(isFallbackBackendApiBaseUrl("http://127.0.0.1:8787/")).toBe(true);
    expect(isFallbackBackendApiBaseUrl("https://story-api.example.com")).toBe(false);
  });

  it("recognizes Cloudflare Quick Tunnel URLs", () => {
    expect(isCloudflareQuickTunnelApiBaseUrl("https://new-tunnel.trycloudflare.com")).toBe(true);
    expect(isCloudflareQuickTunnelApiBaseUrl("https://new-tunnel.trycloudflare.com/")).toBe(true);
    expect(isCloudflareQuickTunnelApiBaseUrl("https://api.storymodeai.com")).toBe(false);
    expect(isCloudflareQuickTunnelApiBaseUrl("http://new-tunnel.trycloudflare.com")).toBe(false);
  });
});
