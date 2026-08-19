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

import { LiveExample } from "./live-example";

describe("LiveExample", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as unknown as Record<string, unknown>).__STAFFBASE_DOCS_EXAMPLES__;
    document.querySelectorAll("script").forEach((el) => el.remove());
  });

  it("shows the static attributes and an unavailable notice when there is no resolver", async () => {
    render(
      <LiveExample
        widgetName="podcast-display-widget"
        bundleUrl="https://cdn.example/podcast-display-widget.js"
        docsExamplesUrl="https://cdn.example/podcast-display-widget.docs-examples.js"
        example={{ title: "Mit Podcast", attributes: { "display-mode": "grid" }, resolve: ["podcast-id"] }}
      />,
    );

    // jsdom does not actually execute the appended <script>, so its "load"/
    // "error" events never fire on their own — dispatch one to unblock the
    // component's await, matching what a real failed fetch would do.
    const script = await screen.findByText("Beispiel wird geladen …").then(
      () => document.querySelector('script[src="https://cdn.example/podcast-display-widget.docs-examples.js"]')!,
    );
    script.dispatchEvent(new Event("error"));

    expect(await screen.findByText(/kein Live-Datensatz/i)).toBeInTheDocument();
    expect(screen.getByText(/"display-mode": "grid"/)).toBeInTheDocument();
  });

  it("renders the static example directly when it needs no resolving", async () => {
    render(
      <LiveExample
        widgetName="table-widget"
        bundleUrl="https://cdn.example/table-widget.js"
        docsExamplesUrl="https://cdn.example/table-widget.docs-examples.js"
        example={{ title: "Standard", attributes: { "display-mode": "grid" } }}
      />,
    );

    expect(await screen.findByText("Standard")).toBeInTheDocument();
    expect(screen.queryByText(/kein Live-Datensatz/i)).not.toBeInTheDocument();
  });

  it("renders a group example as adjacent section columns, one widget instance per member", async () => {
    // customElements.define("content-tabs", ...) is what the real bundle does
    // on load; jsdom does not execute the appended <script>, so it is faked
    // here directly, matching how the other tests unblock loadScriptOnce.
    customElements.define("content-tabs", class extends HTMLElement {});

    const { container } = render(
      <LiveExample
        widgetName="content-tabs"
        bundleUrl="https://cdn.example/content-tabs.js"
        docsExamplesUrl="https://cdn.example/content-tabs.docs-examples.js"
        example={{
          title: "Zwei Tabs",
          attributes: { "tab-title": "Ankündigungen" },
          members: [
            { attributes: { "tab-title": "Ankündigungen" }, content: "Inhalt A" },
            { attributes: { "tab-title": "Termine" }, content: "Inhalt B" },
          ],
        }}
      />,
    );

    await screen.findByText("Zwei Tabs");
    const script = document.querySelector('script[src="https://cdn.example/content-tabs.js"]');
    script?.dispatchEvent(new Event("load"));

    const columns = await screen.findAllByText(/Inhalt (A|B)/);
    expect(columns).toHaveLength(2);

    const section = container.querySelector(".ui-commons__section__wrapper");
    expect(section).not.toBeNull();
    expect(section?.querySelectorAll(".ui-commons__section__column")).toHaveLength(2);
    expect(section?.querySelectorAll("content-tabs")).toHaveLength(2);
  });
});
