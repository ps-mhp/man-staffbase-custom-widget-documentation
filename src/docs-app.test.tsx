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
});
