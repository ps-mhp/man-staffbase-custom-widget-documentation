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

import { loadCatalog } from "./docs-editor";
import { docsEditorShell } from "./docs-dialog";

const LOADER = "https://ps-mhp.github.io/man-staffbase-loader/staffbase-loader.js";
const root = (name: string): string => `https://ps-mhp.github.io/man-staffbase-${name}`;

afterEach(() => {
  jest.restoreAllMocks();
});

describe("loadCatalog", () => {
  it("lists installed widgets by docs title, marking those without docs", async () => {
    const files: Record<string, unknown> = {
      "/api/widgets": {
        data: [{ url: `${LOADER}?widget=table-widget` }, { url: `${LOADER}?widget=chart-widget` }, { url: `${LOADER}?widget=usp-widget` }],
      },
      [`${root("table-widget")}/docs/manifest.json`]: { title: "Tabelle", summary: "Zeigt Tabellen.", pages: [] },
      [`${root("chart-widget")}/docs/manifest.json`]: { title: "Diagramm", summary: "Zeigt Diagramme.", pages: [] },
    };
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      return url in files ? new Response(JSON.stringify(files[url]), { status: 200 }) : new Response("", { status: 404 });
    });

    await expect(loadCatalog()).resolves.toEqual([
      {
        id: "chart-widget",
        title: "Diagramm",
        summary: "Zeigt Diagramme.",
        iconUrl: `${root("chart-widget")}/resources/chart-widget.svg`,
        hasDocs: true,
      },
      {
        id: "table-widget",
        title: "Tabelle",
        summary: "Zeigt Tabellen.",
        iconUrl: `${root("table-widget")}/resources/table-widget.svg`,
        hasDocs: true,
      },
      { id: "usp-widget", title: "usp-widget", summary: "", iconUrl: `${root("usp-widget")}/resources/usp-widget.svg`, hasDocs: false },
    ]);
  });
});

describe("docsEditorShell", () => {
  it("names the window and blocks applying without a widget", () => {
    expect(docsEditorShell.title).toBe("Widget wählen");
    expect(docsEditorShell.validate?.({ widget: null })).toHaveLength(1);
  });
});
