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

/**
 * Which widget, version and page a docs URL points at.
 *
 * Every field is independently optional, mirroring the four shapes a
 * shared link can take:
 *
 *     #/                              overview
 *     #/content-tabs                  a widget, first page
 *     #/content-tabs/settings         a widget and a page
 *     #/content-tabs@1.5.0/settings   ... and a specific docs version
 *
 * `null` means "not given", never "invalid": these functions only read
 * and write the *shape* of a route. Whether the widget is installed, the
 * page exists, or the version was ever released is decided by the caller,
 * which is the only side that knows.
 */
export interface HashRoute {
  widgetName: string | null;
  version: string | null;
  pageId: string | null;
}

/**
 * What the docs app is currently showing. `pageId` may be empty, meaning
 * "this widget's first page" — the app already resolves that against
 * whichever manifest is loaded.
 */
export interface Selection {
  widgetName: string;
  pageId: string;
}

const OVERVIEW: HashRoute = { widgetName: null, version: null, pageId: null };

/**
 * Reads a route from `location.hash`.
 *
 * The leading `#` and `/` are both optional, so a hand-typed or
 * hand-edited URL still works. Segments beyond the page are dropped
 * rather than rejected — a longer path is far more likely to be a link
 * from a future version of this widget than a mistake worth failing on.
 *
 * The `name@version` separator follows the jsDelivr convention this
 * project already uses for bundle URLs. A `@` with nothing after it is
 * read as no version, not as an empty one.
 *
 * A hash that cannot be decoded at all yields the overview: it is then
 * simply not a route this widget can act on — quite possibly it belongs
 * to something else on the host page entirely.
 */
export function parseHashRoute(hash: string): HashRoute {
  const path = hash.replace(/^#/, "").replace(/^\//, "");
  if (path === "") {
    return OVERVIEW;
  }

  const [widgetSegment = "", pageSegment] = path.split("/");
  const separator = widgetSegment.indexOf("@");
  const rawName = separator === -1 ? widgetSegment : widgetSegment.slice(0, separator);
  const rawVersion = separator === -1 ? "" : widgetSegment.slice(separator + 1);

  try {
    const widgetName = decodeURIComponent(rawName);
    return {
      widgetName: widgetName === "" ? null : widgetName,
      version: rawVersion === "" ? null : decodeURIComponent(rawVersion),
      pageId: pageSegment ? decodeURIComponent(pageSegment) : null,
    };
  } catch {
    // Malformed escape (`%zz`) — decodeURIComponent throws.
    return OVERVIEW;
  }
}

/**
 * Writes a route back into a `location.hash` value, including the `#`.
 *
 * Encoding is deliberate rather than cosmetic: a page id containing `/`
 * or `@` would otherwise re-parse as a different route. Widget names and
 * page ids are slugs in practice, so this normally changes nothing.
 *
 * A version or page without a widget has nothing to belong to and is
 * dropped, which keeps `format(parse(x))` stable for every input.
 */
export function formatHashRoute(route: HashRoute): string {
  if (!route.widgetName) {
    return "#/";
  }

  const name = encodeURIComponent(route.widgetName);
  const versioned = route.version ? `${name}@${encodeURIComponent(route.version)}` : name;

  return route.pageId ? `#/${versioned}/${encodeURIComponent(route.pageId)}` : `#/${versioned}`;
}
