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
    expect(parseHashRoute("#/")).toEqual(overview);
  });

  it("reads a widget without a page", () => {
    expect(parseHashRoute("#/content-tabs")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: null,
    });
  });

  it("reads a widget and a page", () => {
    expect(parseHashRoute("#/content-tabs/settings")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: "settings",
    });
  });

  it("reads a widget, a version, and a page", () => {
    expect(parseHashRoute("#/content-tabs@1.5.0/settings")).toEqual({
      widgetName: "content-tabs",
      version: "1.5.0",
      pageId: "settings",
    });
  });

  it("reads a versioned widget without a page", () => {
    expect(parseHashRoute("#/content-tabs@1.5.0")).toEqual({
      widgetName: "content-tabs",
      version: "1.5.0",
      pageId: null,
    });
  });

  it("keeps a pre-release version intact", () => {
    expect(parseHashRoute("#/content-tabs@1.5.0-rc.2/settings").version).toBe("1.5.0-rc.2");
  });

  it("tolerates a hash without the leading slash", () => {
    expect(parseHashRoute("#content-tabs/settings")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: "settings",
    });
  });

  it("ignores segments beyond the page", () => {
    expect(parseHashRoute("#/content-tabs/settings/extra/more")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: "settings",
    });
  });

  it("treats a trailing @ as no version at all", () => {
    expect(parseHashRoute("#/content-tabs@/settings")).toEqual({
      widgetName: "content-tabs",
      version: null,
      pageId: "settings",
    });
  });

  it("decodes percent-encoded segments", () => {
    expect(parseHashRoute("#/content-tabs/erste%20schritte").pageId).toBe("erste schritte");
  });

  // A malformed escape (`%zz`) makes decodeURIComponent throw; the hash is
  // then simply not a route this widget can act on.
  it("falls back to the overview for an undecodable hash", () => {
    expect(parseHashRoute("#/content-tabs/%zz")).toEqual({
      widgetName: null,
      version: null,
      pageId: null,
    });
  });

  it("ignores a hash belonging to something else on the page", () => {
    expect(parseHashRoute("#section-3")).toEqual({
      widgetName: "section-3",
      version: null,
      pageId: null,
    });
  });
});

describe("formatHashRoute", () => {
  it("writes the overview as a bare hash", () => {
    expect(formatHashRoute({ widgetName: null, version: null, pageId: null })).toBe("#/");
  });

  it("writes a widget and a page", () => {
    expect(formatHashRoute({ widgetName: "content-tabs", version: null, pageId: "settings" })).toBe(
      "#/content-tabs/settings",
    );
  });

  it("writes a widget, a version, and a page", () => {
    expect(formatHashRoute({ widgetName: "content-tabs", version: "1.5.0", pageId: "settings" })).toBe(
      "#/content-tabs@1.5.0/settings",
    );
  });

  it("omits a page that is not set", () => {
    expect(formatHashRoute({ widgetName: "content-tabs", version: "1.5.0", pageId: null })).toBe(
      "#/content-tabs@1.5.0",
    );
  });

  // Without a widget there is nothing a version or page could belong to.
  it("ignores a version or page given without a widget", () => {
    expect(formatHashRoute({ widgetName: null, version: "1.5.0", pageId: "settings" })).toBe("#/");
  });

  it("encodes characters that would otherwise split the route", () => {
    expect(formatHashRoute({ widgetName: "content-tabs", version: null, pageId: "a/b" })).toBe(
      "#/content-tabs/a%2Fb",
    );
  });
});

describe("parse/format round trip", () => {
  it.each([
    "#/",
    "#/content-tabs",
    "#/content-tabs/settings",
    "#/content-tabs@1.5.0",
    "#/content-tabs@1.5.0/settings",
    "#/content-tabs@1.5.0-rc.2/settings",
  ])("survives %s unchanged", (hash) => {
    expect(formatHashRoute(parseHashRoute(hash))).toBe(hash);
  });
});
