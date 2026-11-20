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
 * Was der Reader von einem Widget lädt, alles unter dessen Repo-Wurzel auf
 * Pages (siehe `@shared/docs/discovery`):
 *
 *   docs/translation.json     welche Übersetzungen es gibt (fehlt → nur Deutsch)
 *   docs[/<sprache>]/manifest.json und die Kapitel als Markdown
 *   docs/changelog.json       schreibt release.sh (fehlt → kein Kapitel „Änderungen“)
 *   package.json              die ausgelieferte Version
 */

import type { DocsManifest } from "@shared/docs/types";

/** Die Ausgangssprache der Doku; sie liegt direkt in `docs/`. */
export const SOURCE_LANGUAGE = "de";

export interface ChangelogEntry {
  type: "feat" | "fix";
  text: string;
}

export interface ChangelogVersion {
  version: string;
  /** `YYYY-MM-DD` */
  date: string;
  entries: ChangelogEntry[];
}

export interface LoadedDocs {
  language: string;
  /** `<wurzel>/docs` bzw. `<wurzel>/docs/<sprache>`: hier liegen die Kapitel. */
  baseUrl: string;
  manifest: DocsManifest;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

const languageOf = (locale: string): string => locale.toLowerCase().split(/[-_]/)[0];

/**
 * Die erste Sprache der Nutzerin, für die es Doku gibt; sonst Deutsch.
 * `locales` wie `documentLocales()` aus `@shared/staffbase/posts`.
 */
export function pickLanguage(locales: readonly string[], available: readonly string[]): string {
  const known = new Set([SOURCE_LANGUAGE, ...available]);
  return locales.map(languageOf).find((language) => known.has(language)) ?? SOURCE_LANGUAGE;
}

export const docsBaseUrl = (root: string, language: string): string =>
  language === SOURCE_LANGUAGE ? `${root}/docs` : `${root}/docs/${language}`;

/**
 * Manifest in der passenden Sprache. Fehlt die Übersetzung, gilt Deutsch;
 * `null`, wenn das Widget gar keine Doku hat.
 */
export async function loadDocs(root: string, locales: readonly string[]): Promise<LoadedDocs | null> {
  const translation = await fetchJson<{ languages?: unknown }>(`${root}/docs/translation.json`);
  const available = Array.isArray(translation?.languages)
    ? translation.languages.filter((language): language is string => typeof language === "string")
    : [];
  const language = pickLanguage(locales, available);

  for (const candidate of language === SOURCE_LANGUAGE ? [language] : [language, SOURCE_LANGUAGE]) {
    const baseUrl = docsBaseUrl(root, candidate);
    const manifest = await fetchJson<DocsManifest>(`${baseUrl}/manifest.json`);
    if (manifest && Array.isArray(manifest.pages)) return { language: candidate, baseUrl, manifest };
  }
  return null;
}

const isEntry = (value: unknown): value is ChangelogEntry =>
  typeof value === "object" &&
  value !== null &&
  ((value as ChangelogEntry).type === "feat" || (value as ChangelogEntry).type === "fix") &&
  typeof (value as ChangelogEntry).text === "string";

/** Die Versionen aus `docs/changelog.json`, Neueste zuerst; leer, wenn es sie nicht gibt. */
export async function loadChangelog(root: string): Promise<ChangelogVersion[]> {
  const body = await fetchJson<{ versions?: unknown }>(`${root}/docs/changelog.json`);
  if (!Array.isArray(body?.versions)) return [];
  return body.versions.flatMap((value: unknown): ChangelogVersion[] => {
    const version = value as Partial<ChangelogVersion>;
    if (typeof version?.version !== "string" || !Array.isArray(version.entries)) return [];
    const entries = version.entries.filter(isEntry);
    if (entries.length === 0) return [];
    return [{ version: version.version, date: typeof version.date === "string" ? version.date : "", entries }];
  });
}

/** Die Version, die Pages ausliefert (`package.json` auf `main`); `null`, wenn unbekannt. */
export async function loadVersion(root: string): Promise<string | null> {
  const body = await fetchJson<{ version?: unknown }>(`${root}/package.json`);
  return typeof body?.version === "string" && body.version !== "" ? body.version : null;
}
