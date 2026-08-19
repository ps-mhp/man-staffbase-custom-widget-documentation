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

import { parseHashRoute, formatHashRoute } from "./hash-route";

describe("parseHashRoute", () => {
  it("reads the overview from an empty or bare hash", () => {
    const overview = { widgetName: null, version: null, pageId: null };
    expect(parseHashRoute("")).toEqual(overview);
    expect(parseHashRoute("#")).toEqual(overview);
    expect(parseHashRoute("#docs")).toEqual(overview);
  });

  it("reads a widget without a page", () => {
    expect(parseHashRoute("#docs__content-tabs")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: null,
    });
  });

  it("reads a widget and a page", () => {
    expect(parseHashRoute("#docs__content-tabs__settings")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: "settings",
    });
  });

  it("reads a widget, a version, and a page", () => {
    expect(parseHashRoute("#docs__content-tabs_a1_d5_d0__settings")).toEqual({
      widgetName: "content-tabs",
      version: "1.5.0",
      pageId: "settings",
    });
  });

  it("reads a versioned widget without a page", () => {
    expect(parseHashRoute("#docs__content-tabs_a1_d5_d0")).toEqual({
      widgetName: "content-tabs",
      version: "1.5.0",
      pageId: null,
    });
  });

  it("keeps a pre-release version intact", () => {
    expect(parseHashRoute("#docs__content-tabs_a1_d5_d0-rc_d2__settings").version).toBe("1.5.0-rc.2");
  });

  it("ignores segments beyond the page", () => {
    expect(parseHashRoute("#docs__content-tabs__settings__extra__more")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: "settings",
    });
  });

  it("treats a trailing @ as no version at all", () => {
    expect(parseHashRoute("#docs__content-tabs_a__settings")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: "settings",
    });
  });

  it("decodes escaped characters", () => {
    expect(parseHashRoute("#docs__content-tabs__erste_x20schritte").pageId).toBe("erste schritte");
    expect(parseHashRoute("#docs__content-tabs__erste_xc3_xa4").pageId).toBe("erste\u00e4");
    expect(parseHashRoute("#docs__content-tabs__a_ub").pageId).toBe("a_b");
  });

  // A malformed escape makes `decodeSegment` throw; the hash is then
  // simply not a route this widget can act on.
  it("falls back to the overview for an undecodable hash", () => {
    const overview = { widgetName: null, version: null, pageId: null };
    expect(parseHashRoute("#docs__content-tabs___xzz")).toEqual(overview);
    expect(parseHashRoute("#docs__content-tabs___q")).toEqual(overview);
  });

  it("ignores a hash belonging to something else on the page", () => {
    expect(parseHashRoute("#section-3")).toEqual({
      widgetName: null,
      version: null,
      pageId: null,
    });
  });
});

// The shape this widget wrote before the CSS-selector clash was found.
// Links in that shape are already out there and must keep working.
describe("parseHashRoute, links shared in the old format", () => {
  it("reads a widget, a version, and a page", () => {
    expect(parseHashRoute("#/content-tabs@1.5.0/settings")).toEqual({
      widgetName: "content-tabs",
      version: "1.5.0",
      pageId: "settings",
    });
  });

  it("reads a widget and a page", () => {
    expect(parseHashRoute("#/content-tabs/settings")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: "settings",
    });
  });

  it("tolerates a hash without the leading slash", () => {
    expect(parseHashRoute("#content-tabs/settings")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: "settings",
    });
  });

  it("decodes percent-encoded segments", () => {
    expect(parseHashRoute("#/content-tabs/erste%20schritte").pageId).toBe("erste schritte");
  });

  it("falls back to the overview for an undecodable hash", () => {
    expect(parseHashRoute("#/content-tabs/%zz")).toEqual({
      widgetName: null,
      version: null,
      pageId: null,
    });
  });

  it("is rewritten to the current format when it is written back", () => {
    expect(formatHashRoute(parseHashRoute("#/content-tabs@1.5.0/settings"))).toBe(
      "#docs__content-tabs_a1_d5_d0__settings",
    );
  });
});

describe("formatHashRoute", () => {
  it("writes the overview as a bare hash", () => {
    expect(formatHashRoute({ widgetName: null, version: null, pageId: null })).toBe("#docs");
  });

  it("writes a widget and a page", () => {
    expect(formatHashRoute({ widgetName: "content-tabs", version: null, pageId: "settings" })).toBe(
      "#docs__content-tabs__settings",
    );
  });

  it("writes a widget, a version, and a page", () => {
    expect(formatHashRoute({ widgetName: "content-tabs", version: "1.5.0", pageId: "settings" })).toBe(
      "#docs__content-tabs_a1_d5_d0__settings",
    );
  });

  it("omits a page that is not set", () => {
    expect(formatHashRoute({ widgetName: "content-tabs", version: "1.5.0", pageId: null })).toBe(
      "#docs__content-tabs_a1_d5_d0",
    );
  });

  // Without a widget there is nothing a version or page could belong to.
  it("ignores a version or page given without a widget", () => {
    expect(formatHashRoute({ widgetName: null, version: "1.5.0", pageId: "settings" })).toBe("#docs");
  });

  // The host page runs `document.querySelector(location.hash)` to scroll
  // to anchors, so anything written here is also parsed as a selector.
  it.each([
    { widgetName: "content-tabs", version: null, pageId: "a/b" },
    { widgetName: "content-tabs", version: "1.5.0-rc.2", pageId: "erste schritte" },
    { widgetName: "a_b", version: null, pageId: "c.d" },
    { widgetName: "umlaut-\u00e4", version: null, pageId: "stern*" },
    { widgetName: "tick'", version: null, pageId: "klammer(auf)" },
  ])("stays a valid CSS selector for %o", (route) => {
    const hash = formatHashRoute(route);
    expect(hash).toMatch(/^#[A-Za-z][A-Za-z0-9_-]*$/);
    expect(() => document.querySelector(hash)).not.toThrow();
  });
});

describe("parse/format round trip", () => {
  it.each([
    "#docs",
    "#docs__content-tabs",
    "#docs__content-tabs__settings",
    "#docs__content-tabs_a1_d5_d0",
    "#docs__content-tabs_a1_d5_d0__settings",
    "#docs__content-tabs_a1_d5_d0-rc_d2__settings",
    "#docs__content-tabs__erste_x20schritte",
    "#docs__a_ub__c_dd",
  ])("survives %s unchanged", (hash) => {
    expect(formatHashRoute(parseHashRoute(hash))).toBe(hash);
  });
});
