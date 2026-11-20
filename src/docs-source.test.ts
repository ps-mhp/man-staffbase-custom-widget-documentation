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

import { docsBaseUrl, loadChangelog, loadDocs, loadVersion, pickLanguage } from "./docs-source";

const ROOT = "https://ps-mhp.github.io/man-staffbase-table-widget";
const MANIFEST_DE = { title: "Tabelle", summary: "Zeigt Tabellen.", pages: [{ id: "overview", title: "Übersicht", file: "overview.md" }] };
const MANIFEST_EN = { ...MANIFEST_DE, title: "Table", pages: [{ id: "overview", title: "Overview", file: "overview.md" }] };

function serve(files: Record<string, unknown>): jest.SpyInstance {
  return jest.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = input.toString();
    return url in files ? new Response(JSON.stringify(files[url]), { status: 200 }) : new Response("", { status: 404 });
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("pickLanguage", () => {
  it("takes the first user language that has docs", () => {
    expect(pickLanguage(["fr_FR", "en_US"], ["en", "fr"])).toBe("fr");
    expect(pickLanguage(["sv_SE", "en-GB"], ["en"])).toBe("en");
  });

  it("falls back to German, the source language", () => {
    expect(pickLanguage(["sv_SE"], ["en"])).toBe("de");
    expect(pickLanguage([], [])).toBe("de");
    expect(pickLanguage(["de_DE"], [])).toBe("de");
  });
});

describe("docsBaseUrl", () => {
  it("puts German at docs/ and translations below it", () => {
    expect(docsBaseUrl(ROOT, "de")).toBe(`${ROOT}/docs`);
    expect(docsBaseUrl(ROOT, "en")).toBe(`${ROOT}/docs/en`);
  });
});

describe("loadDocs", () => {
  it("loads the translation the user reads", async () => {
    serve({
      [`${ROOT}/docs/translation.json`]: { languages: ["en", "fr"] },
      [`${ROOT}/docs/en/manifest.json`]: MANIFEST_EN,
      [`${ROOT}/docs/manifest.json`]: MANIFEST_DE,
    });
    await expect(loadDocs(ROOT, ["en_US"])).resolves.toEqual({
      language: "en",
      baseUrl: `${ROOT}/docs/en`,
      manifest: MANIFEST_EN,
    });
  });

  it("falls back to German when the translation's manifest is missing", async () => {
    serve({
      [`${ROOT}/docs/translation.json`]: { languages: ["en"] },
      [`${ROOT}/docs/manifest.json`]: MANIFEST_DE,
    });
    await expect(loadDocs(ROOT, ["en_US"])).resolves.toMatchObject({ language: "de", baseUrl: `${ROOT}/docs` });
  });

  it("reads German without translation.json", async () => {
    serve({ [`${ROOT}/docs/manifest.json`]: MANIFEST_DE });
    await expect(loadDocs(ROOT, ["en_US"])).resolves.toMatchObject({ language: "de" });
  });

  it("returns null for a widget without docs", async () => {
    serve({});
    await expect(loadDocs(ROOT, ["de_DE"])).resolves.toBeNull();
  });

  it("returns null when the network fails", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    await expect(loadDocs(ROOT, ["de_DE"])).resolves.toBeNull();
  });
});

describe("loadChangelog", () => {
  it("keeps valid versions and entries, newest first as written", async () => {
    serve({
      [`${ROOT}/docs/changelog.json`]: {
        versions: [
          { version: "0.2.0", date: "2026-11-20", entries: [{ type: "feat", text: "Neu" }, { type: "chore", text: "x" }] },
          { version: "0.1.0", entries: [{ type: "fix", text: "Behoben" }] },
          { version: "0.0.9", date: "2026-01-01", entries: [{ type: "docs", text: "nur Doku" }] },
          { date: "2026-01-01", entries: [] },
        ],
      },
    });
    await expect(loadChangelog(ROOT)).resolves.toEqual([
      { version: "0.2.0", date: "2026-11-20", entries: [{ type: "feat", text: "Neu" }] },
      { version: "0.1.0", date: "", entries: [{ type: "fix", text: "Behoben" }] },
    ]);
  });

  it("is empty when the file is missing or malformed", async () => {
    serve({ [`${ROOT}/docs/changelog.json`]: { versions: "nope" } });
    await expect(loadChangelog(ROOT)).resolves.toEqual([]);
    serve({});
    await expect(loadChangelog(ROOT)).resolves.toEqual([]);
  });
});

describe("loadVersion", () => {
  it("reads the served package.json version", async () => {
    serve({ [`${ROOT}/package.json`]: { version: "0.3.0-rc.2" } });
    await expect(loadVersion(ROOT)).resolves.toBe("0.3.0-rc.2");
  });

  it("is null without a usable version", async () => {
    serve({ [`${ROOT}/package.json`]: { version: "" } });
    await expect(loadVersion(ROOT)).resolves.toBeNull();
  });
});
