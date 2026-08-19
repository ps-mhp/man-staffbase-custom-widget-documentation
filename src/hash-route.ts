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
 *     #docs                                    overview
 *     #docs__content-tabs                      a widget, first page
 *     #docs__content-tabs__settings            a widget and a page
 *     #docs__content-tabs_a1_d5_d0__settings   ... and a specific docs version
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
 * Marks the fragment as ours.
 *
 * Two jobs, both worth the six characters: a hash belonging to something
 * else on the Staffbase page is recognisably not a route (see
 * `parseHashRoute`), and our own fragment cannot accidentally match a real
 * element id on that page and send the browser scrolling to it.
 */
const PREFIX = "docs";

/** Separates the route's segments — see `encodeSegment` for why it is doubled. */
const SEPARATOR = "__";

/**
 * The alphabet a fragment may use.
 *
 * Narrower than the URL spec allows, and deliberately so: the host page
 * runs `document.querySelector(location.hash)` to scroll to anchors, so
 * every hash this widget writes is also parsed as a CSS selector. `#/a/b`
 * is not a valid one and throws a `SyntaxError` in the host's code —
 * which means a shared link would break the page it was shared into.
 *
 * A CSS id selector accepts letters, digits, `-` and `_`, so those pass
 * through unescaped and route slugs stay readable. `_` is the escape
 * character; everything else is spelled out with it:
 *
 *     @   →  _a        version separator
 *     .   →  _d        version dots (`1.5.0` → `1_d5_d0`)
 *     _   →  _u        a literal underscore in a slug
 *     any →  _xHH…     UTF-8 bytes, as in percent-encoding
 *
 * `_` is always followed by a code letter, so the doubled `__` between
 * segments can never be mistaken for one — which is exactly why the
 * separator is doubled.
 */
const SHORT_ESCAPES: Record<string, string> = { "@": "_a", ".": "_d", _: "_u" };
const REVERSE_ESCAPES: Record<string, string> = { a: "@", d: ".", u: "_" };

function encodeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/g, (character) => {
    const short = SHORT_ESCAPES[character];
    if (short) return short;

    // `encodeURIComponent` already does the UTF-8 work; only the spelling
    // differs, since `%` itself is not allowed in a selector either. It
    // leaves `!'()*~` alone, though — harmless in a URL, not in a
    // selector — so those are spelled out from their (always ASCII) code.
    const percentEncoded = encodeURIComponent(character);
    return percentEncoded.startsWith("%")
      ? percentEncoded.replace(/%/g, "_x").toLowerCase()
      : `_x${character.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
}

/** Throws on a malformed escape, which the callers below read as "not a route". */
function decodeSegment(value: string): string {
  let decoded = "";
  let index = 0;

  while (index < value.length) {
    if (value[index] !== "_") {
      decoded += value[index];
      index += 1;
      continue;
    }

    const code = value[index + 1];
    const short = code === undefined ? undefined : REVERSE_ESCAPES[code];
    if (short) {
      decoded += short;
      index += 2;
      continue;
    }

    if (code !== "x") {
      throw new Error(`Unknown escape "_${code ?? ""}"`);
    }

    // A single character can span several bytes, and each byte is its own
    // `_xHH`, so the whole run has to be handed to `decodeURIComponent`
    // together — byte by byte it would decode to mojibake at best.
    let percentEncoded = "";
    while (value[index] === "_" && value[index + 1] === "x") {
      const hex = value.slice(index + 2, index + 4);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
        throw new Error(`Malformed escape "_x${hex}"`);
      }
      percentEncoded += `%${hex}`;
      index += 4;
    }
    decoded += decodeURIComponent(percentEncoded);
  }

  return decoded;
}

/**
 * Reads the format this widget wrote before the selector clash above was
 * found: `#/content-tabs@1.5.0/settings`.
 *
 * Kept because links have already been shared in that shape, and a dead
 * link is a worse outcome than a few lines here. Nothing writes it any
 * more — opening such a link rewrites the URL to the current format.
 */
function parseLegacyPath(path: string): HashRoute {
  const [widgetSegment = "", pageSegment] = path.replace(/^\//, "").split("/");
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
 * Reads a route from `location.hash`.
 *
 * Segments beyond the page are dropped rather than rejected — a longer
 * path is far more likely to be a link from a future version of this
 * widget than a mistake worth failing on.
 *
 * A hash that is not ours, or cannot be decoded at all, yields the
 * overview: it is then simply not a route this widget can act on — quite
 * possibly it belongs to something else on the host page entirely.
 */
export function parseHashRoute(hash: string): HashRoute {
  const raw = hash.replace(/^#/, "");
  if (raw === "" || raw === PREFIX) {
    return OVERVIEW;
  }

  // The old format is the only one containing `/`, which the current one
  // cannot produce.
  if (raw.includes("/")) {
    return parseLegacyPath(raw);
  }

  if (!raw.startsWith(PREFIX + SEPARATOR)) {
    return OVERVIEW;
  }

  const [widgetSegment = "", pageSegment] = raw.slice(PREFIX.length + SEPARATOR.length).split(SEPARATOR);

  try {
    const [rawName = "", rawVersion = ""] = splitVersion(decodeSegment(widgetSegment));
    return {
      widgetName: rawName === "" ? null : rawName,
      version: rawVersion === "" ? null : rawVersion,
      pageId: pageSegment ? decodeSegment(pageSegment) : null,
    };
  } catch {
    return OVERVIEW;
  }
}

/**
 * Splits `name@version` after decoding. The first `@` wins, matching the
 * jsDelivr convention this project already uses for bundle URLs, and a
 * `@` with nothing after it is read as no version rather than an empty one.
 */
function splitVersion(widget: string): [string, string] {
  const separator = widget.indexOf("@");
  return separator === -1 ? [widget, ""] : [widget.slice(0, separator), widget.slice(separator + 1)];
}

/**
 * Writes a route back into a `location.hash` value, including the `#`.
 *
 * A version or page without a widget has nothing to belong to and is
 * dropped, which keeps `format(parse(x))` stable for every input.
 */
export function formatHashRoute(route: HashRoute): string {
  if (!route.widgetName) {
    return `#${PREFIX}`;
  }

  const widget = encodeSegment(route.version ? `${route.widgetName}@${route.version}` : route.widgetName);
  const segments = route.pageId ? [widget, encodeSegment(route.pageId)] : [widget];

  return `#${[PREFIX, ...segments].join(SEPARATOR)}`;
}
