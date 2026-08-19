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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnyOrama } from "@orama/orama";

import { discoverWidgetDocs, DiscoveredWidgetDocs, ParsedBundleUrl, docsBaseUrlFor, docsExamplesUrlFor } from "@shared/docs/discovery";
import { currentStableVersion } from "@shared/docs/versions";
import type { DocsManifest } from "@shared/docs/types";
import { buildSearchIndex, querySearchIndex, SearchDoc, SearchHit } from "./search";
import { MarkdownPage } from "./markdown-page";
import { LiveExample } from "./live-example";
import { LoadingSurface } from "./loading-surface";
import type { Selection } from "./hash-route";
import { useHashRoute } from "./use-hash-route";

/**
 * The docs/examples URLs for whichever version of a widget's docs are
 * currently being viewed, and the bundle URL for its live example.
 *
 * These two concerns are independent and must not be conflated: docs/
 * examples URLs should be reused from `widget` whenever the requested
 * version matches `widget.docsVersion` (the version `discoverWidgetDocs`
 * actually fetched — usually the newest *stable* release, not necessarily
 * what's installed, see its doc comment) to avoid a redundant network
 * round-trip; the *bundle* URL must instead only be reused from `widget`
 * when the requested version matches `widget.installedVersion` — anything
 * else recomputes a jsDelivr URL for that tag. Using the docs-preferred
 * bundle here instead would try to load a second, differently-versioned
 * bundle for the same custom-element tag name into `<LiveExample>`, which
 * the browser's custom-element registry rejects outright (a tag name can
 * only ever be `customElements.define`d once, no matter how many script
 * tags claim to define it again).
 */
interface VersionedDocsLocation {
  version: string;
  docsBaseUrl: string;
  docsExamplesUrl: string;
  bundleUrl: string;
}

function versionedLocationFor(widget: DiscoveredWidgetDocs, version: string): VersionedDocsLocation {
  const usesInstalledBundle = version === widget.installedVersion || !widget.repo;
  const usesCachedDocs = version === widget.docsVersion || !widget.repo;
  const parsed: ParsedBundleUrl | null =
    widget.repo && !(usesInstalledBundle && usesCachedDocs) ? { kind: "jsdelivr", repo: widget.repo, version, name: widget.name } : null;

  return {
    version,
    docsBaseUrl: usesCachedDocs ? widget.docsBaseUrl : docsBaseUrlFor(parsed!),
    docsExamplesUrl: usesCachedDocs ? widget.docsExamplesUrl : docsExamplesUrlFor(parsed!),
    bundleUrl: usesInstalledBundle ? widget.bundleUrl : `https://cdn.jsdelivr.net/gh/${widget.repo}@${version}/dist/${widget.name}.js`,
  };
}

/**
 * Fetches and caches the manifest for whichever version of a widget's docs
 * is currently selected. Reuses `widget.manifest` (already fetched by
 * `discoverWidgetDocs`, for `widget.docsVersion`) without a network
 * round-trip when the selected version matches that — which is the
 * default and by far the most common case — and only fetches an alternate
 * manifest when the editor actually picks a different version from the
 * dropdown, since older releases can have a different set of pages
 * entirely.
 *
 * Returns an explicit `error` flag alongside `manifest` so the caller can
 * tell "still loading" (`manifest: null, error: false`) apart from "failed"
 * (`manifest: null, error: true`) — a manifest that 404s (a tag predating
 * `/docs`, a typo'd version, a deleted release) must not be shown as an
 * indefinite loading spinner, the editor needs to be told it's actually
 * broken.
 */
function useVersionedManifest(
  widget: DiscoveredWidgetDocs | null,
  location: VersionedDocsLocation | null,
): { manifest: DocsManifest | null; error: boolean } {
  const [manifest, setManifest] = useState<DocsManifest | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!widget || !location) {
      setManifest(null);
      setError(false);
      return;
    }
    if (location.version === widget.docsVersion || !widget.repo) {
      setManifest(widget.manifest);
      setError(false);
      return;
    }

    let cancelled = false;
    setManifest(null);
    setError(false);
    fetch(`${location.docsBaseUrl}/manifest.json`)
      .then((response) => (response.ok ? (response.json() as Promise<DocsManifest>) : null))
      .then((fetched) => {
        if (cancelled) return;
        setManifest(fetched);
        if (!fetched) setError(true);
      })
      .catch(() => {
        if (!cancelled) {
          setManifest(null);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [widget, location]);

  return { manifest, error };
}

/**
 * The docs version shown for a widget when nobody picked one.
 *
 * Deliberately the newest *stable* release rather than whatever tag this
 * page happens to have installed: a page can easily run an old,
 * never-updated bundle, and defaulting to that would show stale docs and
 * spam 404s for versions cut before `/docs` existed. `installedVersion`
 * counts only where it is itself the newest stable release — see
 * `currentStableVersion` for the jsDelivr metadata lag that makes that a
 * routine case rather than an exotic one — or when no stable version can
 * be determined at all (local dev-server widgets, a failed jsDelivr
 * lookup, a widget that has so far only ever shipped pre-releases).
 */
function defaultVersionFor(widget: DiscoveredWidgetDocs | null): string | null {
  return widget ? currentStableVersion(widget.availableVersions, widget.installedVersion) : null;
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
          const latestVersion = currentStableVersion(widget.availableVersions, widget.installedVersion);
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

  // A version that arrived with a shared link has to survive the effect
  // below, which fires right after the selection it came with and would
  // otherwise immediately reset it to the default.
  const requestedVersionRef = useRef<string | null>(null);

  // The version-switch dropdown resets to the default whenever the
  // selected widget changes (see `defaultVersionFor`), unless a version
  // came in with the URL.
  useEffect(() => {
    setViewingVersion(requestedVersionRef.current ?? defaultVersionFor(selectedWidget));
    requestedVersionRef.current = null;
  }, [selectedWidget?.name]);

  const handleNavigate = useCallback(
    (next: Selection | null, nextVersion: string | null) => {
      requestedVersionRef.current = nextVersion;
      setSelection(next);
      // Set here as well, not just in the effect above: moving between two
      // versions of the *same* widget leaves its name unchanged, so the
      // effect never runs.
      const target = widgets?.find((widget) => widget.name === next?.widgetName) ?? null;
      setViewingVersion(nextVersion ?? defaultVersionFor(target));
    },
    [widgets],
  );

  useHashRoute({
    widgets,
    selection,
    version: viewingVersion,
    defaultVersion: defaultVersionFor(selectedWidget),
    onNavigate: handleNavigate,
  });

  // `"local"` is a sentinel, not a real version — used only for widgets
  // registered under a local dev-server URL (`kind: "local"` in
  // `discovery.ts`, `!widget.repo` here), which have no version concept
  // at all (`installedVersion`/`docsVersion` are both `undefined`).
  // Falling through to `null` there instead — as this used to — made
  // `location` below permanently `null` for such a widget, and with it
  // `useVersionedManifest` (which requires a `location`) never resolves:
  // the widget got stuck on the loading state forever. `versionedLocationFor`
  // already ignores the `version` argument entirely for repo-less widgets
  // (see its doc comment), so the sentinel only ever surfaces cosmetically,
  // in the version-bar's (disabled) label below.
  const effectiveVersion = selectedWidget
    ? viewingVersion ?? selectedWidget.installedVersion ?? selectedWidget.docsVersion ?? "local"
    : null;
  const location = useMemo(
    () => (selectedWidget ? versionedLocationFor(selectedWidget, effectiveVersion ?? "local") : null),
    [selectedWidget, effectiveVersion],
  );
  const { manifest: versionedManifest, error: versionedManifestError } = useVersionedManifest(selectedWidget, location);

  const selectedPage = useMemo(
    () => versionedManifest?.pages.find((page) => page.id === selection?.pageId) ?? versionedManifest?.pages[0] ?? null,
    [versionedManifest, selection],
  );

  const latestVersion = defaultVersionFor(selectedWidget);
  const isViewingOutdatedVersion = Boolean(
    selectedWidget && latestVersion && effectiveVersion && effectiveVersion !== latestVersion,
  );
  // Always at least one entry once a widget is selected — even a widget
  // with a single release, or none at all yet (empty `availableVersions`)
  // — so the version-bar below never has to hide for lack of options; see
  // its own comment for why it must always be visible regardless.
  //
  // Crucially, `selectedWidget.availableVersions` comes from jsDelivr's
  // *separate* package-metadata endpoint (`fetchAvailableVersions`), which
  // is independently cached and can lag well behind the CDN files
  // themselves — a release that is already live and already installed
  // (`installedVersion`, read straight from the host's own `/api/widgets`
  // response) can be entirely absent from that metadata list for a while
  // after release. If `effectiveVersion` (which prefers `installedVersion`)
  // were left out just because the stale metadata list doesn't mention it
  // yet, the `<select>`'s `value` would point at a version with no
  // matching `<option>` — the browser then silently falls back to
  // whatever option happens to be first, and the actually-installed
  // version simply never appears in the dropdown at all. So it is always
  // merged in, deduplicated, and put first — it is the version actually
  // running right now, however new.
  const versionOptions = useMemo(() => {
    if (!selectedWidget) return [];
    const known = selectedWidget.availableVersions;
    if (effectiveVersion && !known.includes(effectiveVersion)) {
      return [effectiveVersion, ...known];
    }
    return known.length > 0 ? known : effectiveVersion ? [effectiveVersion] : [];
  }, [selectedWidget, effectiveVersion]);

  if (!widgets) {
    return <LoadingSurface label="Widgets werden gesucht …" />;
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
            {location && (
              // The version-switch UI must always be visible whenever a
              // widget is selected — otherwise an editor stuck on a
              // broken/loading version (see the error/loading branches
              // below) has no way to switch away from it at all. It no
              // longer hides for a single- or zero-version widget either
              // (see `versionOptions`); a repo-less local dev-server
              // widget instead gets a single disabled option, since there
              // is genuinely only ever one place its docs can come from.
              <div className="docs-app__version-bar">
                <label className="docs-app__version-label" htmlFor="docs-app-version-select">
                  Version
                </label>
                <select
                  id="docs-app-version-select"
                  className="docs-app__version-select"
                  value={location.version}
                  onChange={(event) => setViewingVersion(event.target.value)}
                  disabled={!selectedWidget.repo}
                >
                  {selectedWidget.repo ? (
                    versionOptions.map((version) => {
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
                    })
                  ) : (
                    <option value={location.version}>Lokale Entwicklungsversion</option>
                  )}
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
            {versionedManifestError ? (
              <p className="docs-app__status docs-app__status--error">
                Dokumentation für Version {effectiveVersion} konnte nicht geladen werden.
              </p>
            ) : !versionedManifest || !location || !selectedPage ? (
              <LoadingSurface label={`Dokumentation für Version ${effectiveVersion} wird geladen …`} />
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
