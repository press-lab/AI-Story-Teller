/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HelpPage } from "./HelpPage";

describe("HelpPage documentation UI", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows technical documentation topics and filters them with search", async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    expect(screen.getByRole("heading", { name: "Story Mode AI Documentation" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Context Contract" })[0]).toBeInTheDocument();

    await user.type(screen.getByLabelText(/search the guide/i), "mutation");

    expect(screen.getAllByRole("link", { name: "AI Mutation Boundaries" })[0]).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Context Contract" })).not.toBeInTheDocument();
  });

  it("documents every sidebar destination as its own searchable topic", async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    [
      "New User Guide",
      "Home / Library",
      "Current Story Home",
      "Play",
      "History",
      "Memory Suggestions",
      "Reference Cards",
      "Character Cards — Voice Contract",
      "Characters",
      "Current Story Arc",
      "World Blocks",
      "Context Inspector",
      "Automations",
      "Backups & Transfer",
      "Settings",
      "Documentation",
    ].forEach((label) => {
      expect(screen.getAllByRole("link", { name: label })[0]).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText(/search the guide/i));
    await user.type(screen.getByLabelText(/search the guide/i), "chronicle");

    expect(screen.getAllByRole("link", { name: "History" })[0]).toBeInTheDocument();
    expect(screen.getByText(/complete local transcript/i)).toBeInTheDocument();
  });

  it("keeps the topics list and documentation body as separate scroll regions", () => {
    render(<HelpPage />);

    expect(document.querySelector(".docs-page")).toBeInTheDocument();
    expect(document.querySelector(".docs-toc")).toBeInTheDocument();
    expect(document.querySelector(".docs-content")).toBeInTheDocument();
    expect(document.querySelectorAll(".docs-topic")).toHaveLength(1);
  });

  it("shows one readable topic at a time and lets the reader choose another", async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    await user.click(screen.getByRole("link", { name: "Context Contract" }));
    expect(screen.getByRole("heading", { name: "Context Contract" })).toBeInTheDocument();
    expect(document.querySelectorAll(".docs-topic")).toHaveLength(1);
  });

  it("offers a useful empty search state and lets the reader return to all guides", async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    await user.type(screen.getByLabelText(/search the guide/i), "no-topic-has-this-name");

    expect(screen.getByRole("heading", { name: "Try a broader search" })).toBeInTheDocument();
    expect(screen.getByText("0 guides")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getAllByRole("link", { name: "New User Guide" })[0]).toBeInTheDocument();
  });

  it("documents Next Turn Note as an inspectable context lane", async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    await user.type(screen.getByLabelText(/search the guide/i), "next turn note");

    expect(screen.getAllByText("Next Turn Note")[0]).toBeInTheDocument();
    expect(screen.getByText(/visible, token-counted, and expires after use by default/i)).toBeInTheDocument();
  });

  it("surfaces the high-level new user guide", async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    await user.type(screen.getByLabelText(/search the guide/i), "new user");

    expect(screen.getAllByRole("link", { name: "New User Guide" })[0]).toBeInTheDocument();
    expect(screen.getByText(/Scenarios are reusable setups/i)).toBeInTheDocument();
    expect(screen.getByText(/docs\/new-user-guide\.md/i)).toBeInTheDocument();
  });
});
