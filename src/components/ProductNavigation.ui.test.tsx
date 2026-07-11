/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductNavigation } from "./ProductNavigation";

describe("ProductNavigation", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() {
        return values.size;
      },
    };
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  });

  afterEach(() => {
    cleanup();
  });

  it("uses the Story Mode AI brand and keeps advanced story tools out of the app rail", async () => {
    const user = userEvent.setup();
    render(
      <ProductNavigation
        active="home"
        currentStoryTitle="A Test Story"
        isAdmin
        onNavigate={vi.fn()}
      />,
    );

    const primaryNav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(screen.getByRole("button", { name: "Story Mode AI home" })).toBeInTheDocument();
    expect(within(primaryNav).getByRole("button", { name: "Admin Console" })).toBeInTheDocument();
    expect(within(primaryNav).queryByRole("button", { name: "Automation" })).not.toBeInTheDocument();
    expect(within(primaryNav).queryByRole("button", { name: "Context Inspector" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(screen.getByRole("complementary")).toHaveClass("is-collapsed");
    expect(window.localStorage.getItem("story-mode-ai-navigation-collapsed")).toBe("true");
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeInTheDocument();
  });

  it("keeps mobile More focused on navigation rather than Studio diagnostics", async () => {
    const user = userEvent.setup();
    render(
      <ProductNavigation
        active="play"
        currentStoryTitle="A Test Story"
        isAdmin
        onNavigate={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More" }));
    const more = screen.getByRole("region", { name: "More navigation" });
    expect(within(more).getByRole("button", { name: "History" })).toBeInTheDocument();
    expect(within(more).getByRole("button", { name: "Backups & Transfer" })).toBeInTheDocument();
    expect(within(more).getByRole("button", { name: "Admin Console" })).toBeInTheDocument();
    expect(within(more).queryByRole("button", { name: "Automation (Advanced)" })).not.toBeInTheDocument();
    expect(within(more).queryByRole("button", { name: "Context Inspector (Advanced)" })).not.toBeInTheDocument();
  });

  it("restores the collapsed preference without hiding destinations or suggestion status", async () => {
    window.localStorage.setItem("story-mode-ai-navigation-collapsed", "true");
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductNavigation
        active="studio"
        currentStoryTitle="A Test Story"
        pendingSuggestions={3}
        onNavigate={onNavigate}
      />,
    );

    const rail = screen.getByRole("complementary");
    expect(rail).toHaveClass("is-collapsed");
    const studio = within(rail).getByRole("button", { name: "Story Studio, 3 pending suggestions" });
    expect(studio).toHaveAttribute("aria-current", "page");
    expect(within(studio).getByText("3")).toHaveClass("nav-badge");

    const toggle = within(rail).getByRole("button", { name: "Expand navigation" });
    expect(toggle).toHaveAttribute("aria-controls", "product-navigation-rail");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(within(rail).getByRole("button", { name: "Home" }));
    expect(onNavigate).toHaveBeenCalledWith("home");
  });
});
