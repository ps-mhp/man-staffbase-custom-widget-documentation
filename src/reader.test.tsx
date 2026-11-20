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
import { fireEvent, render, screen } from "@testing-library/react";

import { DocsReader } from "./reader";

const LOADER = "https://ps-mhp.github.io/man-staffbase-loader/staffbase-loader.js";
const ROOT = "https://ps-mhp.github.io/man-staffbase-table-widget";

const MANIFEST = {
  title: "Tabelle",
  summary: "Zeigt Tabellen.",
  pages: [
    { id: "overview", title: "Übersicht", file: "overview.md" },
    { id: "settings", title: "Einstellungen", file: "settings.md" },
  ],
};

type Files = Record<string, unknown>;

const BASE_FILES: Files = {
  "/api/widgets": { data: [{ url: `${LOADER}?widget=table-widget` }] },
  [`${ROOT}/docs/translation.json`]: { languages: ["en"] },
  [`${ROOT}/docs/manifest.json`]: MANIFEST,
  [`${ROOT}/docs/overview.md`]: "# Tabelle\n\nWorum es geht. Mehr unter [Einstellungen](settings.md).",
  [`${ROOT}/docs/settings.md`]: "# Einstellungen\n\nAlle Felder.",
  [`${ROOT}/docs/changelog.json`]: {
    versions: [{ version: "0.3.0", date: "2026-11-20", entries: [{ type: "feat", text: "Spalten sortieren" }] }],
  },
  [`${ROOT}/package.json`]: { version: "0.3.0" },
};

function serve(files: Files): jest.SpyInstance {
  return jest.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (!(url in files)) return new Response("", { status: 404 });
    const body = files[url];
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200 });
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DocsReader", () => {
  it("asks for a widget when none is configured", () => {
    const fetchSpy = serve(BASE_FILES);
    render(<DocsReader widgetName={null} locales={["de_DE"]} />);
    expect(screen.getByText(/Kein Widget gewählt/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("says so when the widget is not installed here", async () => {
    serve(BASE_FILES);
    render(<DocsReader widgetName="chart-widget" locales={["de_DE"]} />);
    expect(await screen.findByText(/„chart-widget“ ist in dieser Umgebung nicht installiert/)).toBeInTheDocument();
  });

  it("says so when the widget has no docs", async () => {
    serve({ "/api/widgets": BASE_FILES["/api/widgets"] });
    render(<DocsReader widgetName="table-widget" locales={["de_DE"]} />);
    expect(await screen.findByText(/noch keine Dokumentation/)).toBeInTheDocument();
  });

  it("shows the manifest's chapters plus the changelog, the first chapter open, and the served version", async () => {
    serve(BASE_FILES);
    render(<DocsReader widgetName="table-widget" locales={["de_DE"]} />);

    expect(await screen.findByRole("heading", { name: "Tabelle" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Kapitel" });
    expect(Array.from(nav.querySelectorAll("button")).map((button) => button.textContent)).toEqual([
      "Übersicht",
      "Einstellungen",
      "Änderungen",
    ]);
    expect(screen.getByRole("button", { name: "Übersicht" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Stand: Version 0.3.0")).toBeInTheDocument();
  });

  it("switches chapters from the navigation and from links in the text", async () => {
    serve(BASE_FILES);
    render(<DocsReader widgetName="table-widget" locales={["de_DE"]} />);

    fireEvent.click(await screen.findByRole("link", { name: "Einstellungen" }));
    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Änderungen" }));
    expect(screen.getByRole("heading", { name: "Änderungen" })).toBeInTheDocument();
    expect(screen.getByText("Spalten sortieren")).toBeInTheDocument();
    expect(screen.getByText("Neu:")).toBeInTheDocument();
  });

  it("leaves out the changelog chapter when there is no changelog", async () => {
    serve(Object.fromEntries(Object.entries(BASE_FILES).filter(([url]) => !url.endsWith("/changelog.json"))));
    render(<DocsReader widgetName="table-widget" locales={["de_DE"]} />);

    await screen.findByRole("heading", { name: "Tabelle" });
    expect(screen.queryByRole("button", { name: "Änderungen" })).not.toBeInTheDocument();
  });

  it("reads the user's language and labels the reader in it", async () => {
    serve({
      ...BASE_FILES,
      [`${ROOT}/docs/en/manifest.json`]: { ...MANIFEST, pages: [{ id: "overview", title: "Overview", file: "overview.md" }] },
      [`${ROOT}/docs/en/overview.md`]: "# Table\n\nWhat it is for.",
    });
    render(<DocsReader widgetName="table-widget" locales={["en_US"]} />);

    expect(await screen.findByRole("heading", { name: "Table" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Chapters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Changes" })).toBeInTheDocument();
    expect(screen.getByText("Version 0.3.0")).toBeInTheDocument();
  });
});
