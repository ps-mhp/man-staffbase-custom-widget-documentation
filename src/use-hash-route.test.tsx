/*!
 * Copyright 2026, MHP Management und IT-Beratung GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

import { DocsApp } from "./docs-app";

const WIDGET = "podcast-display-widget";
const REPO = "ps-mhp/man-staffbase-podcast-display-widget";

const MANIFEST = {
  title: "Podcast-Anzeige",
  summary: "Zeigt einen Podcast oder eine Episode an.",
  pages: [
    { id: "overview", title: "Übersicht", file: "overview.md" },
    { id: "settings", title: "Einstellungen", file: "settings.md" },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Two released versions, so the version in a URL has something to name. */
function mockFetch(): void {
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url === "/api/widgets") {
      return jsonResponse({ data: [{ url: `https://cdn.jsdelivr.net/gh/${REPO}@1.0.0/dist/${WIDGET}.js` }] });
    }
    if (url === `https://data.jsdelivr.com/v1/packages/gh/${REPO}`) {
      return jsonResponse({ versions: [{ version: "1.1.0" }, { version: "1.0.0" }] });
    }
    if (url.endsWith("/docs/manifest.json")) {
      return jsonResponse(MANIFEST);
    }
    if (url.endsWith("overview.md")) {
      return new Response("# Übersicht\n\nZeigt Podcasts.");
    }
    if (url.endsWith("settings.md")) {
      return new Response("# Einstellungen\n\nStellt den Anzeigemodus ein.");
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

function setHash(hash: string): void {
  window.history.replaceState(null, "", hash);
}

describe("docs navigation in the URL", () => {
  beforeEach(() => {
    setHash("/");
    mockFetch();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the page named in the URL", async () => {
    setHash(`#/${WIDGET}/settings`);

    render(<DocsApp />);

    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
  });

  it("opens a widget's first page when the URL names no page", async () => {
    setHash(`#/${WIDGET}`);

    render(<DocsApp />);

    expect(await screen.findByRole("heading", { name: "Übersicht" })).toBeInTheDocument();
  });

  it("keeps the shared URL intact while the widget list is still loading", async () => {
    setHash(`#/${WIDGET}/settings`);

    render(<DocsApp />);

    // The starting state is "overview, nothing selected". Were it written
    // out before the widget list arrives, it would overwrite exactly the
    // link that was just opened — the one bug that silently breaks sharing.
    expect(window.location.hash).toBe(`#/${WIDGET}/settings`);
    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#/${WIDGET}/settings`);
  });

  it("writes the URL as the reader navigates", async () => {
    render(<DocsApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Podcast-Anzeige" }));
    await waitFor(() => expect(window.location.hash).toBe(`#/${WIDGET}/overview`));

    fireEvent.click(await screen.findByRole("button", { name: "Einstellungen" }));
    await waitFor(() => expect(window.location.hash).toBe(`#/${WIDGET}/settings`));
  });

  it("goes back to the previous page when the browser goes back", async () => {
    render(<DocsApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Podcast-Anzeige" }));
    fireEvent.click(await screen.findByRole("button", { name: "Einstellungen" }));
    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();

    // jsdom keeps the history entries but fires no popstate for `back()`.
    setHash(`#/${WIDGET}/overview`);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByRole("heading", { name: "Übersicht" })).toBeInTheDocument();
  });

  it("shows the overview for a link to a widget that is not installed here", async () => {
    setHash("#/not-installed-widget/settings");

    render(<DocsApp />);

    expect(await screen.findByRole("button", { name: "Podcast-Anzeige" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Einstellungen" })).not.toBeInTheDocument();
  });

  it("opens the docs version named in the URL", async () => {
    setHash(`#/${WIDGET}@1.0.0/settings`);

    render(<DocsApp />);

    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
    expect((await screen.findByLabelText("Version")) as HTMLSelectElement).toHaveValue("1.0.0");
  });

  it("ignores a version in the URL that was never released", async () => {
    setHash(`#/${WIDGET}@9.9.9/settings`);

    render(<DocsApp />);

    // Falls back to the default (newest stable) rather than showing a
    // blank page whose every request 404s.
    expect((await screen.findByLabelText("Version")) as HTMLSelectElement).toHaveValue("1.1.0");
  });

  it("leaves the default version out of the URL, so shared links keep showing current docs", async () => {
    render(<DocsApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Podcast-Anzeige" }));
    await waitFor(() => expect(window.location.hash).toBe(`#/${WIDGET}/overview`));

    fireEvent.change(await screen.findByLabelText("Version"), { target: { value: "1.0.0" } });
    await waitFor(() => expect(window.location.hash).toBe(`#/${WIDGET}@1.0.0/overview`));
  });
});
