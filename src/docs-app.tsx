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

import { discoverWidgetDocs, DiscoveredWidgetDocs, ParsedBundleUrl, docsBaseUrlFor, docsExamplesUrlFor } from "@shared/docs/discovery";
import { latestStableVersion } from "@shared/docs/versions";
import type { DocsManifest } from "@shared/docs/types";
import { buildSearchIndex, querySearchIndex, SearchDoc, SearchHit } from "./search";
import { MarkdownPage } from "./markdown-page";
import { LiveExample } from "./live-example";

interface Selection {
  widgetName: string;
  pageId: string;
}

/**
 * The docs/examples URLs for whichever version of a widget's docs are
 * currently being viewed — either the installed version (the common case,
 * `widget.docsBaseUrl`/`widget.docsExamplesUrl` as discovered), or an
 * older release picked from the version dropdown, in which case these are
 * recomputed from the widget's repo for that specific tag.
 */
interface VersionedDocsLocation {
  version: string;
  docsBaseUrl: string;
  docsExamplesUrl: string;
  bundleUrl: string;
}

function versionedLocationFor(widget: DiscoveredWidgetDocs, version: string): VersionedDocsLocation {
  if (version === widget.installedVersion || !widget.repo) {
    return {
      version,
      docsBaseUrl: widget.docsBaseUrl,
      docsExamplesUrl: widget.docsExamplesUrl,
      bundleUrl: widget.bundleUrl,
    };
  }
  const parsed: ParsedBundleUrl = { kind: "jsdelivr", repo: widget.repo, version, name: widget.name };
  return {
    version,
    docsBaseUrl: docsBaseUrlFor(parsed),
    docsExamplesUrl: docsExamplesUrlFor(parsed),
    bundleUrl: `https://cdn.jsdelivr.net/gh/${widget.repo}@${version}/dist/${widget.name}.js`,
  };
}

/**
 * Fetches and caches the manifest for whichever version of a widget's docs
 * is currently selected. Reuses `widget.manifest` (already fetched by
 * `discoverWidgetDocs`) without a network round-trip when the selected
 * version is the installed one — which is the default and by far the most
 * common case — and only fetches an alternate manifest when the editor
 * actually picks a different version from the dropdown, since older
 * releases can have a different set of pages entirely.
 */
function useVersionedManifest(
  widget: DiscoveredWidgetDocs | null,
  location: VersionedDocsLocation | null,
): DocsManifest | null {
  const [manifest, setManifest] = useState<DocsManifest | null>(null);

  useEffect(() => {
    if (!widget || !location) {
      setManifest(null);
      return;
    }
    if (location.version === widget.installedVersion || !widget.repo) {
      setManifest(widget.manifest);
      return;
    }

    let cancelled = false;
    setManifest(null);
    fetch(`${location.docsBaseUrl}/manifest.json`)
      .then((response) => (response.ok ? (response.json() as Promise<DocsManifest>) : null))
      .then((fetched) => {
        if (!cancelled) setManifest(fetched);
      })
      .catch(() => {
        if (!cancelled) setManifest(null);
      });
    return () => {
      cancelled = true;
    };
  }, [widget, location]);

  return manifest;
}

export function DocsApp(): React.JSX.Element {
  const [widgets, setWidgets] = useState<DiscoveredWidgetDocs[] | null>(null);
  const [searchIndex, setSearchIndex] = useState<AnyOrama | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);


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
          // Search always indexes the *current* (latest stable) docs, not
          // whatever old tag this particular page happens to have
          // installed — otherwise a stale install (see
          // `versionedLocationFor`) would make search either 404 silently
          // or surface outdated content for no benefit to the editor
          // typing a query. "Current" is deliberately the newest *stable*
          // tag, never an in-progress `-rc.N` pre-release.
          const latestVersion = latestStableVersion(widget.availableVersions);
          const searchLocation = latestVersion ? versionedLocationFor(widget, latestVersion) : null;
          const url = `${searchLocation?.docsBaseUrl ?? widget.docsBaseUrl}/${page.file}`;
          const response = await fetch(url);
          // A missing page here is routine (an installed widget pinned to
          // an old pre-docs tag, a widget with no docs yet) — indexing
          // simply skips it rather than warning for every such page on
          // every editor's page load.
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

  // The version-switch dropdown always defaults to the latest *stable*
  // docs version, not whatever happens to be installed on this particular
  // page — a page can easily be running an old, never-updated bundle tag,
  // and defaulting to that would silently show stale docs (and, worse,
  // immediately spam 404s for versions cut before `/docs` existed) instead
  // of the current, correct documentation. "Current" deliberately skips
  // in-progress `-rc.N` pre-releases (see `latestStableVersion`); fall
  // back to `installedVersion` only when no stable version could be
  // determined at all (local dev-server widgets, a jsDelivr lookup
  // failure, or a widget that has only ever shipped pre-releases so far).
  useEffect(() => {
    setViewingVersion(
      (selectedWidget && latestStableVersion(selectedWidget.availableVersions)) ??
        selectedWidget?.installedVersion ??
        null,
    );
  }, [selectedWidget?.name]);

  const effectiveVersion = viewingVersion ?? selectedWidget?.installedVersion ?? null;
  const location = useMemo(
    () => (selectedWidget && effectiveVersion ? versionedLocationFor(selectedWidget, effectiveVersion) : null),
    [selectedWidget, effectiveVersion],
  );
  const versionedManifest = useVersionedManifest(selectedWidget, location);

  const selectedPage = useMemo(
    () => versionedManifest?.pages.find((page) => page.id === selection?.pageId) ?? versionedManifest?.pages[0] ?? null,
    [versionedManifest, selection],
  );

  const latestVersion = selectedWidget ? latestStableVersion(selectedWidget.availableVersions) : null;
  const isViewingOutdatedVersion = Boolean(
    selectedWidget && latestVersion && effectiveVersion && effectiveVersion !== latestVersion,
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
                  {(versionedManifest ?? widget.manifest).pages.map((page) => (
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
        {!selectedWidget ? (
          <div>
            <h1 className="docs-app__title">Übersicht der Widgets</h1>
            <ul className="docs-app__overview-list">
              {widgets.map((widget) => (
                <li className="docs-app__overview-card" key={widget.name}>
                  <img
                    className="docs-app__overview-card-icon"
                    src={widget.iconUrl}
                    alt=""
                    aria-hidden="true"
                    onError={(event) => {
                      // The SVG resolves structurally (see `iconUrlFor`) but
                      // a network hiccup or an unusually old release
                      // predating `resources/` could still 404 it — hide the
                      // broken-image icon rather than showing the browser's
                      // placeholder glyph.
                      event.currentTarget.style.visibility = "hidden";
                    }}
                  />
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
            {selectedWidget.availableVersions.length > 1 && location && (
              <div className="docs-app__version-bar">
                <label className="docs-app__version-label" htmlFor="docs-app-version-select">
                  Version
                </label>
                <select
                  id="docs-app-version-select"
                  className="docs-app__version-select"
                  value={location.version}
                  onChange={(event) => setViewingVersion(event.target.value)}
                >
                  {selectedWidget.availableVersions.map((version) => {
                    const isLatest = version === latestVersion;
                    // Only call out "installed" when it differs from
                    // "current" — if they're the same version, the
                    // "(aktuell)" label alone already says everything;
                    // showing both would just be noise.
                    const isInstalled =
                      version === selectedWidget.installedVersion && selectedWidget.installedVersion !== latestVersion;
                    return (
                      <option key={version} value={version}>
                        {version}
                        {isLatest ? " (aktuell)" : ""}
                        {isInstalled ? " (installiert)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            {isViewingOutdatedVersion && latestVersion && (
              <p className="docs-app__version-warning">
                Sie sehen die Dokumentation für Version {location?.version}, nicht die aktuellste Version (
                {latestVersion}).{" "}
                <button
                  type="button"
                  className="docs-app__version-warning-link"
                  onClick={() => setViewingVersion(latestVersion)}
                >
                  Zur aktuellen Version wechseln
                </button>
              </p>
            )}
            {!versionedManifest || !location || !selectedPage ? (
              <p className="docs-app__status">Dokumentation für Version {effectiveVersion} wird geladen …</p>
            ) : (
              <>
                <MarkdownPage url={`${location.docsBaseUrl}/${selectedPage.file}`} />
                {versionedManifest.examples &&
                  selectedPage.id === versionedManifest.pages[0]?.id &&
                  versionedManifest.examples.map((example) => (
                    <LiveExample
                      key={example.title}
                      widgetName={selectedWidget.name}
                      bundleUrl={location.bundleUrl}
                      docsExamplesUrl={location.docsExamplesUrl}
                      example={example}
                    />
                  ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
