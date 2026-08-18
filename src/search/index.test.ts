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

import { buildSearchIndex, querySearchIndex } from "./index";

describe("search index", () => {
  it("finds a page by a term that only appears in its content", async () => {
    const db = await buildSearchIndex([
      {
        widgetName: "podcast-display-widget",
        pageId: "overview",
        pageTitle: "Übersicht",
        content: "Dieses Widget zeigt Podcasts und Episoden an.",
      },
      {
        widgetName: "table-widget",
        pageId: "overview",
        pageTitle: "Übersicht",
        content: "Dieses Widget rendert eine Tabelle aus einer Excel-Datei.",
      },
    ]);

    const hits = await querySearchIndex(db, "Podcasts");

    expect(hits).toEqual([
      {
        widgetName: "podcast-display-widget",
        pageId: "overview",
        pageTitle: "Übersicht",
      },
    ]);
  });

  it("finds a page by a term in its title", async () => {
    const db = await buildSearchIndex([
      {
        widgetName: "table-widget",
        pageId: "faq",
        pageTitle: "FAQ",
        content: "Häufig gestellte Fragen.",
      },
    ]);

    const hits = await querySearchIndex(db, "FAQ");

    expect(hits).toHaveLength(1);
    expect(hits[0].pageId).toBe("faq");
  });

  it("returns no hits for a term that matches nothing", async () => {
    const db = await buildSearchIndex([
      {
        widgetName: "table-widget",
        pageId: "overview",
        pageTitle: "Übersicht",
        content: "Tabellen aus Excel-Dateien.",
      },
    ]);

    const hits = await querySearchIndex(db, "nichtvorhandenerbegriff");

    expect(hits).toEqual([]);
  });

  it("returns no hits for a blank search term without querying the index", async () => {
    const db = await buildSearchIndex([
      {
        widgetName: "table-widget",
        pageId: "overview",
        pageTitle: "Übersicht",
        content: "Tabellen aus Excel-Dateien.",
      },
    ]);

    expect(await querySearchIndex(db, "")).toEqual([]);
    expect(await querySearchIndex(db, "   ")).toEqual([]);
  });
});
