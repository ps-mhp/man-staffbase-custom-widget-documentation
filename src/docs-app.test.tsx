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
import { render, screen, fireEvent } from "@testing-library/react";

import { DocsApp } from "./docs-app";

const PODCAST_MANIFEST = {
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

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

function mockFetch(): void {
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url === "/api/widgets") {
      return jsonResponse({
        data: [
          {
            url: "https://cdn.jsdelivr.net/gh/ps-mhp/man-staffbase-podcast-display-widget@1.0.0/dist/podcast-display-widget.js",
          },
        ],
      });
    }
    if (url.endsWith("/docs/manifest.json")) {
      return jsonResponse(PODCAST_MANIFEST);
    }
    if (url.endsWith("overview.md")) {
      return textResponse("# Übersicht\n\nZeigt Podcasts.");
    }
    if (url.endsWith("settings.md")) {
      return textResponse("# Einstellungen\n\nStellt den Anzeigemodus ein.");
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

/**
 * Same as `mockFetch`, but the widget also has an older released version
 * (`0.9.0`) whose docs manifest 404s — e.g. a tag cut before `/docs`
 * existed — so tests can assert the error message shown for a version
 * that fails to load, and that the version dropdown stays available to
 * switch away from it.
 */
function mockFetchWithBrokenOldVersion(): void {
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url === "/api/widgets") {
      return jsonResponse({
        data: [
          {
            url: "https://cdn.jsdelivr.net/gh/ps-mhp/man-staffbase-podcast-display-widget@1.0.0/dist/podcast-display-widget.js",
          },
        ],
      });
    }
    if (url === "https://data.jsdelivr.com/v1/packages/gh/ps-mhp/man-staffbase-podcast-display-widget") {
      return jsonResponse({ versions: [{ version: "1.0.0" }, { version: "0.9.0" }] });
    }
    if (url.includes("@0.9.0")) {
      return new Response(null, { status: 404 });
    }
    if (url.endsWith("/docs/manifest.json")) {
      return jsonResponse(PODCAST_MANIFEST);
    }
    if (url.endsWith("overview.md")) {
      return textResponse("# Übersicht\n\nZeigt Podcasts.");
    }
    if (url.endsWith("settings.md")) {
      return textResponse("# Einstellungen\n\nStellt den Anzeigemodus ein.");
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("DocsApp", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lists discovered widgets in the sidebar and shows the overview by default", async () => {
    mockFetch();

    render(<DocsApp />);

    expect(await screen.findByRole("button", { name: "Podcast-Anzeige" })).toBeInTheDocument();
    expect(screen.getByText("Zeigt einen Podcast oder eine Episode an.")).toBeInTheDocument();
  });

  it("shows a widget's page content when its nav button is clicked", async () => {
    mockFetch();

    render(<DocsApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Podcast-Anzeige" }));
    fireEvent.click(await screen.findByRole("button", { name: "Einstellungen" }));

    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
  });

  it("returns search results across all discovered widgets' pages", async () => {
    mockFetch();

    render(<DocsApp />);

    const searchBox = await screen.findByPlaceholderText("Suchen …");
    fireEvent.change(searchBox, { target: { value: "Anzeigemodus" } });

    expect(await screen.findByRole("button", { name: /Einstellungen/ })).toBeInTheDocument();
  });

  it("shows an error (not an endless loading state) when a picked docs version fails to load, and keeps the version selector usable", async () => {
    mockFetchWithBrokenOldVersion();

    render(<DocsApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Podcast-Anzeige" }));

    const versionSelect = await screen.findByLabelText("Version");
    fireEvent.change(versionSelect, { target: { value: "0.9.0" } });

    expect(await screen.findByText("Dokumentation für Version 0.9.0 konnte nicht geladen werden.")).toBeInTheDocument();
    // The selector itself must stay visible/usable so the editor can switch
    // away from the broken version — it must not be hidden by the error.
    expect(screen.getByLabelText("Version")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Version"), { target: { value: "1.0.0" } });
    expect(await screen.findByRole("heading", { name: "Übersicht" })).toBeInTheDocument();
  });

  it("always shows the version selector once a widget is picked, even with a single available release", async () => {
    mockFetch();

    render(<DocsApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Podcast-Anzeige" }));

    // `mockFetch` only ever registers one version (1.0.0, no jsDelivr
    // version-history lookup at all) — the selector must not hide just
    // because there is nothing else to switch to.
    expect(await screen.findByLabelText("Version")).toBeInTheDocument();
  });

  it("shows content (not an endless loading state) for a widget registered under a local dev-server URL, with a disabled version selector", async () => {
    const localBundleUrl = "http://localhost:8080/podcast-display-widget/podcast-display-widget.js";
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/widgets") {
        return jsonResponse({ data: [{ url: localBundleUrl }] });
      }
      if (url.endsWith("/docs/manifest.json")) {
        return jsonResponse(PODCAST_MANIFEST);
      }
      if (url.endsWith("overview.md")) {
        return textResponse("# Übersicht\n\nZeigt Podcasts.");
      }
      if (url.endsWith("settings.md")) {
        return textResponse("# Einstellungen\n\nStellt den Anzeigemodus ein.");
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<DocsApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Podcast-Anzeige" }));

    // Before the fix, a repo-less (local dev-server) widget never resolved
    // a `location` at all, so it got stuck showing the loading skeleton
    // forever. It must now render the actual page content...
    expect(await screen.findByRole("heading", { name: "Übersicht" })).toBeInTheDocument();
    // ...and the version selector must still be present (always visible),
    // just disabled — there's genuinely only one place its docs come from.
    const versionSelect = screen.getByLabelText("Version") as HTMLSelectElement;
    expect(versionSelect).toBeDisabled();
    expect(screen.getByText("Lokale Entwicklungsversion")).toBeInTheDocument();
  });

  it("shows the actually-installed version as an option even when jsDelivr's separate version-listing metadata hasn't caught up to it yet", async () => {
    // Reproduces the real scenario verbatim: a widget was just released and
    // installed at 0.2.0-rc.1, but jsDelivr's package-metadata endpoint
    // (`data.jsdelivr.com`, a cache independent from the CDN files
    // themselves) still only lists the older 0.1.0-rc.* tags — it has not
    // picked up the new release yet. The dropdown must still show the
    // version that is actually running, not just what that lagging list
    // happens to know about.
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/widgets") {
        return jsonResponse({
          data: [
            {
              url: "https://cdn.jsdelivr.net/gh/ps-mhp/man-staffbase-content-tabs@0.2.0-rc.1/dist/content-tabs.js",
            },
          ],
        });
      }
      if (url === "https://data.jsdelivr.com/v1/packages/gh/ps-mhp/man-staffbase-content-tabs") {
        // Stale: does not yet mention 0.1.1 or 0.2.0-rc.1.
        return jsonResponse({
          versions: [
            { version: "0.1.0-rc.5" },
            { version: "0.1.0-rc.4" },
            { version: "0.1.0-rc.3" },
            { version: "0.1.0-rc.2" },
            { version: "0.1.0-rc.1" },
          ],
        });
      }
      if (url.endsWith("/docs/manifest.json")) {
        return jsonResponse({
          title: "Content-Tabs",
          summary: "Fasst benachbarte Spalten einer Section zu einer Tab-Gruppe zusammen.",
          pages: [{ id: "overview", title: "Übersicht", file: "overview.md" }],
        });
      }
      if (url.endsWith("overview.md")) {
        return textResponse("# Übersicht\n\nContent-Tabs.");
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<DocsApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Content-Tabs" }));
    await screen.findByRole("heading", { name: "Übersicht" });

    const versionSelect = await screen.findByLabelText("Version");
    const optionValues = Array.from(versionSelect.querySelectorAll("option")).map((option) => option.value);

    expect(optionValues).toContain("0.2.0-rc.1");
    expect((versionSelect as HTMLSelectElement).value).toBe("0.2.0-rc.1");
  });
});
