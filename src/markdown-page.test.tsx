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
import { render, screen } from "@testing-library/react";

import { MarkdownPage } from "./markdown-page";

function mockFetch(implementation: () => Promise<Response>): jest.SpyInstance {
  return jest.spyOn(globalThis, "fetch").mockImplementation(implementation as never);
}

describe("MarkdownPage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows a loading notice while the markdown is on its way", () => {
    mockFetch(() => new Promise(() => {}));

    render(<MarkdownPage url="https://cdn.example/docs/overview.md" />);

    expect(screen.getByText(/wird geladen/i)).toBeInTheDocument();
  });

  it("renders fetched markdown as HTML", async () => {
    mockFetch(async () => new Response("# Titel\n\nEin **fetter** Text.", { status: 200 }));

    render(<MarkdownPage url="https://cdn.example/docs/overview.md" />);

    expect(await screen.findByRole("heading", { name: "Titel" })).toBeInTheDocument();
    expect(screen.getByText("fetter")).toBeInTheDocument();
  });

  it("shows an error notice when the fetch fails", async () => {
    mockFetch(async () => new Response("not found", { status: 404 }));

    render(<MarkdownPage url="https://cdn.example/docs/missing.md" />);

    expect(await screen.findByText(/konnte nicht geladen werden/i)).toBeInTheDocument();
  });

  it("re-fetches when the url prop changes", async () => {
    const fetchSpy = mockFetch(async () => new Response("# Erste Seite", { status: 200 }));

    const { rerender } = render(<MarkdownPage url="https://cdn.example/docs/a.md" />);
    expect(await screen.findByRole("heading", { name: "Erste Seite" })).toBeInTheDocument();

    fetchSpy.mockImplementation(async () => new Response("# Zweite Seite", { status: 200 }) as never);
    rerender(<MarkdownPage url="https://cdn.example/docs/b.md" />);

    expect(await screen.findByRole("heading", { name: "Zweite Seite" })).toBeInTheDocument();
  });
});
