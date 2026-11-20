/*!
 * Copyright 2026, Staffbase SE and contributors.
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

import { chapterFileOf, MarkdownPage, MarkdownPageProps } from "./markdown-page";

function mockFetch(implementation: () => Promise<Response>): jest.SpyInstance {
  return jest.spyOn(globalThis, "fetch").mockImplementation(implementation as never);
}

const LABELS = { loadingLabel: "Seite wird geladen …", errorLabel: "Diese Seite konnte nicht geladen werden." };

function renderPage(props: Partial<MarkdownPageProps> & { url: string }): ReturnType<typeof render> {
  return render(<MarkdownPage {...LABELS} {...props} />);
}

describe("chapterFileOf", () => {
  it.each([
    ["settings.md", "settings.md"],
    ["./faq.md", "faq.md"],
    ["faq.md#frage-1", "faq.md"],
    ["https://example.com/settings.md", null],
    ["#anker", null],
    [undefined, null],
  ])("%s → %s", (href, file) => {
    expect(chapterFileOf(href)).toBe(file);
  });
});

describe("MarkdownPage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("announces loading while the markdown is on its way", () => {
    mockFetch(() => new Promise(() => {}));
    renderPage({ url: "https://cdn.example/docs/overview.md" });
    expect(screen.getByRole("status")).toHaveTextContent("Seite wird geladen …");
  });

  it("renders fetched markdown as HTML", async () => {
    mockFetch(async () => new Response("# Titel\n\nEin **fetter** Text.", { status: 200 }));
    renderPage({ url: "https://cdn.example/docs/overview.md" });
    expect(await screen.findByRole("heading", { name: "Titel" })).toBeInTheDocument();
    expect(screen.getByText("fetter")).toBeInTheDocument();
  });

  it("shows the error label when the fetch fails", async () => {
    mockFetch(async () => new Response("not found", { status: 404 }));
    renderPage({ url: "https://cdn.example/docs/missing.md" });
    expect(await screen.findByText(LABELS.errorLabel)).toBeInTheDocument();
  });

  it("re-fetches when the url prop changes", async () => {
    const fetchSpy = mockFetch(async () => new Response("# Erste Seite", { status: 200 }));
    const { rerender } = renderPage({ url: "https://cdn.example/docs/a.md" });
    expect(await screen.findByRole("heading", { name: "Erste Seite" })).toBeInTheDocument();

    fetchSpy.mockImplementation(async () => new Response("# Zweite Seite", { status: 200 }) as never);
    rerender(<MarkdownPage {...LABELS} url="https://cdn.example/docs/b.md" />);
    expect(await screen.findByRole("heading", { name: "Zweite Seite" })).toBeInTheDocument();
  });

  it("turns a link to another chapter into a chapter switch", async () => {
    mockFetch(async () => new Response("Siehe [Einstellungen](settings.md).", { status: 200 }));
    const onChapterLink = jest.fn(() => true);
    renderPage({ url: "https://cdn.example/docs/overview.md", onChapterLink });

    const link = await screen.findByRole("link", { name: "Einstellungen" });
    const event = fireEvent.click(link);

    expect(onChapterLink).toHaveBeenCalledWith("settings.md");
    expect(event).toBe(false);
  });

  it("opens external links in a new tab", async () => {
    mockFetch(async () => new Response("[MAN](https://www.man.eu)", { status: 200 }));
    renderPage({ url: "https://cdn.example/docs/overview.md" });

    const link = await screen.findByRole("link", { name: "MAN" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
