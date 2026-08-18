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

/** Shown on a widget's overview card when its manifest has no `icon`. */
const DEFAULT_WIDGET_ICON = "🧩";

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

      const pageRefs = discovered.flatMap((widget) =>
        widget.manifest.pages.map((page) => ({ widget, page })),
      );
      const docs = await Promise.all(
        pageRefs.map(async ({ widget, page }): Promise<SearchDoc> => {
          const url = `${widget.docsBaseUrl}/${page.file}`;
          // Deliberate: surfaces every requested widget doc page in the
          // browser console for debugging.
          console.log(`[custom-widget-documentation] fetching docs page: ${url}`);
          const response = await fetch(url);
          if (!response.ok) {
            console.log(`[custom-widget-documentation] docs page unavailable: ${url} (HTTP ${response.status})`);
          }
          const content = response.ok ? await response.text() : "";
          return {
            widgetName: widget.name,
            pageId: page.id,
            pageTitle: page.title,
            content,
          };
        }),
      );
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
    return <p className="docs-app__status">Widgets werden gesucht …</p>;
  }

  return (
    <div className="docs-app">
      <nav className="docs-app__sidebar">
        <input
          className="docs-app__search"
          type="search"
          placeholder="Suchen …"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        {searchHits.length > 0 && (
          <ul className="docs-app__search-results">
            {searchHits.map((hit) => (
              <li key={`${hit.widgetName}-${hit.pageId}`}>
                <button
                  type="button"
                  className="docs-app__nav-button docs-app__nav-button--search-hit"
                  onClick={() => setSelection({ widgetName: hit.widgetName, pageId: hit.pageId })}
                >
                  {hit.pageTitle} <span className="docs-app__search-hit-widget">({hit.widgetName})</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className={`docs-app__nav-button docs-app__nav-button--top${selection === null ? " docs-app__nav-button--active" : ""}`}
          onClick={() => setSelection(null)}
        >
          Übersicht
        </button>

        <p className="docs-app__nav-heading">Widgets</p>
        <ul className="docs-app__widget-list">
          {widgets.map((widget) => (
            <li className="docs-app__widget" key={widget.name}>
              <button
                type="button"
                className={`docs-app__nav-button${selectedWidget?.name === widget.name ? " docs-app__nav-button--active" : ""}`}
                onClick={() =>
                  setSelection({ widgetName: widget.name, pageId: widget.manifest.pages[0]?.id ?? "" })
                }
              >
                {widget.manifest.title}
              </button>
              {selectedWidget?.name === widget.name && (
                <ul className="docs-app__page-list">
                  {widget.manifest.pages.map((page) => (
                    <li key={page.id}>
                      <button
                        type="button"
                        className={`docs-app__nav-button docs-app__nav-button--page${selectedPage?.id === page.id ? " docs-app__nav-button--active" : ""}`}
                        onClick={() => setSelection({ widgetName: widget.name, pageId: page.id })}
                      >
                        {page.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <main className="docs-app__content">
        {!selectedWidget || !selectedPage ? (
          <div>
            <h1 className="docs-app__title">Übersicht der Widgets</h1>
            <ul className="docs-app__overview-list">
              {widgets.map((widget) => (
                <li className="docs-app__overview-card" key={widget.name}>
                  <span className="docs-app__overview-card-icon" aria-hidden="true">
                    {widget.manifest.icon ?? DEFAULT_WIDGET_ICON}
                  </span>
                  <div className="docs-app__overview-card-body">
                    <strong className="docs-app__overview-card-title">{widget.manifest.title}</strong>
                    <p className="docs-app__overview-card-summary">{widget.manifest.summary}</p>
                    <button
                      type="button"
                      className="docs-app__overview-card-link"
                      onClick={() =>
                        setSelection({ widgetName: widget.name, pageId: widget.manifest.pages[0]?.id ?? "" })
                      }
                    >
                      Zur Dokumentation →
                    </button>
                  </div>
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
