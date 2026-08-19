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

import { useCallback, useEffect, useRef } from "react";
import { DiscoveredWidgetDocs } from "@shared/docs/discovery";
import { HashRoute, Selection, parseHashRoute, formatHashRoute } from "./hash-route";

export interface UseHashRouteOptions {
  /** `null` until `discoverWidgetDocs()` has answered. */
  widgets: DiscoveredWidgetDocs[] | null;
  selection: Selection | null;
  /** The docs version currently being viewed, if any. */
  version: string | null;
  /** The version that would be shown without an explicit choice. */
  defaultVersion: string | null;
  /** Applies a route that arrived from the URL (first load, back, forward). */
  onNavigate: (selection: Selection | null, version: string | null) => void;
}

/**
 * Resolves a parsed route against the widgets actually installed here.
 *
 * Only the widget is verified. An unknown one means the link points at
 * something this reader hasn't installed, so the overview is the honest
 * answer — better than an empty page.
 *
 * The page id is deliberately *not* checked against the manifest: the
 * manifest currently in hand belongs to the default version, while the
 * link may name a page that only exists in the version it also names.
 * Passing the id through lets the caller resolve it against the right
 * manifest once that has loaded — and its existing "unknown page falls
 * back to the first one" behaviour covers the genuinely missing case.
 *
 * A version that was never released is dropped rather than honoured;
 * every URL pointing at it would otherwise 404 its way to a blank page.
 */
function resolve(
  route: HashRoute,
  widgets: DiscoveredWidgetDocs[],
): { selection: Selection | null; version: string | null } {
  const widget = widgets.find((candidate) => candidate.name === route.widgetName);
  if (!widget) {
    return { selection: null, version: null };
  }

  const version = route.version && widget.availableVersions.includes(route.version) ? route.version : null;

  return { selection: { widgetName: widget.name, pageId: route.pageId ?? "" }, version };
}

/**
 * Mirrors the current selection in the page URL's fragment, so a reader
 * can share a link to a specific page and use the browser's back button
 * inside the docs.
 *
 * Only the fragment is touched. Path and query belong to the Staffbase
 * page this widget is embedded in.
 *
 * Reading comes first and writing waits for it: until the widgets are
 * known, an incoming route cannot be resolved, and writing the (empty)
 * starting state before then would overwrite the very link that was just
 * opened.
 */
export function useHashRoute({ widgets, selection, version, defaultVersion, onNavigate }: UseHashRouteOptions): void {
  // Writing stays off until an incoming URL has been consumed.
  const readyRef = useRef(false);
  // Keeps the effects below from depending on a caller's inline callback,
  // which would otherwise re-subscribe the listener on every render.
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;

  const apply = useCallback((installed: DiscoveredWidgetDocs[]) => {
    const { selection: next, version: nextVersion } = resolve(parseHashRoute(window.location.hash), installed);
    navigateRef.current(next, nextVersion);
  }, []);

  useEffect(() => {
    if (!widgets || readyRef.current) return;
    apply(widgets);
    readyRef.current = true;
  }, [widgets, apply]);

  // `popstate` covers the browser's back and forward buttons; `hashchange`
  // covers a fragment edited by hand in the address bar. Neither fires for
  // this widget's own `pushState`, and the write below skips a hash that is
  // already correct, so the two directions cannot drive each other.
  useEffect(() => {
    function onPopState(): void {
      if (widgets) apply(widgets);
    }

    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onPopState);
    };
  }, [widgets, apply]);

  useEffect(() => {
    if (!readyRef.current) return;

    // The version is written only when it differs from what a reader
    // would see anyway. Pinning every link to today's version would mean
    // shared links quietly keep showing old docs forever, long after the
    // widget has moved on.
    const hash = formatHashRoute({
      widgetName: selection?.widgetName ?? null,
      version: version && version !== defaultVersion ? version : null,
      pageId: selection?.pageId || null,
    });

    if (hash !== window.location.hash) {
      window.history.pushState(null, "", hash);
    }
  }, [selection, version, defaultVersion]);
}
