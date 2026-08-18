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

import React, { useEffect, useMemo, useState } from "react";
import type { AnyOrama } from "@orama/orama";

import { discoverWidgetDocs, DiscoveredWidgetDocs } from "@shared/docs/discovery";
import { buildSearchIndex, querySearchIndex, SearchDoc, SearchHit } from "./search";
import { MarkdownPage } from "./markdown-page";
import { LiveExample } from "./live-example";

interface Selection {
  widgetName: string;
  pageId: string;
}

export function DocsApp(): React.JSX.Element {
  const [widgets, setWidgets] = useState<DiscoveredWidgetDocs[] | null>(null);
  const [searchIndex, setSearchIndex] = useState<AnyOrama | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const discovered = await discoverWidgetDocs();
      if (cancelled) return;
      setWidgets(discovered);

      const docs: SearchDoc[] = [];
      for (const widget of discovered) {
        for (const page of widget.manifest.pages) {
          const response = await fetch(`${widget.docsBaseUrl}/${page.file}`);
          const content = response.ok ? await response.text() : "";
          docs.push({
            widgetName: widget.name,
            pageId: page.id,
            pageTitle: page.title,
            content,
          });
        }
      }
      if (!cancelled) {
        setSearchIndex(await buildSearchIndex(docs));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!searchIndex) return;

    querySearchIndex(searchIndex, searchTerm).then((hits) => {
      if (!cancelled) setSearchHits(hits);
    });

    return () => {
      cancelled = true;
    };
  }, [searchIndex, searchTerm]);

  const selectedWidget = useMemo(
    () => widgets?.find((widget) => widget.name === selection?.widgetName) ?? null,
    [widgets, selection],
  );
  const selectedPage = useMemo(
    () => selectedWidget?.manifest.pages.find((page) => page.id === selection?.pageId) ?? null,
    [selectedWidget, selection],
  );

  if (!widgets) {
    return <p>Widgets werden gesucht …</p>;
  }

  return (
    <div className="docs-app">
      <nav className="docs-app__sidebar">
        <input
          type="search"
          placeholder="Suchen …"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        {searchHits.length > 0 && (
          <ul>
            {searchHits.map((hit) => (
              <li key={`${hit.widgetName}-${hit.pageId}`}>
                <button onClick={() => setSelection({ widgetName: hit.widgetName, pageId: hit.pageId })}>
                  {hit.pageTitle} ({hit.widgetName})
                </button>
              </li>
            ))}
          </ul>
        )}

        <button onClick={() => setSelection(null)}>Übersicht</button>

        <p>Widgets</p>
        {widgets.map((widget) => (
          <div key={widget.name}>
            <button
              onClick={() => setSelection({ widgetName: widget.name, pageId: widget.manifest.pages[0]?.id ?? "" })}
            >
              {widget.manifest.title}
            </button>
            {selectedWidget?.name === widget.name && (
              <ul>
                {widget.manifest.pages.map((page) => (
                  <li key={page.id}>
                    <button onClick={() => setSelection({ widgetName: widget.name, pageId: page.id })}>
                      {page.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>

      <main className="docs-app__content">
        {!selectedWidget || !selectedPage ? (
          <div>
            <h1>Übersicht der Widgets</h1>
            <ul>
              {widgets.map((widget) => (
                <li key={widget.name}>
                  <strong>{widget.manifest.title}</strong>
                  <p>{widget.manifest.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <MarkdownPage url={`${selectedWidget.docsBaseUrl}/${selectedPage.file}`} />
            {selectedWidget.manifest.examples &&
              selectedPage.id === selectedWidget.manifest.pages[0]?.id &&
              selectedWidget.manifest.examples.map((example) => (
                <LiveExample
                  key={example.title}
                  widgetName={selectedWidget.name}
                  bundleUrl={selectedWidget.bundleUrl}
                  docsExamplesUrl={selectedWidget.docsExamplesUrl}
                  example={example}
                />
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
