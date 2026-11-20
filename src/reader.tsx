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
 * Die Doku eines Widgets, live von Pages: links (schmal: oben) die Kapitel
 * aus seinem Manifest plus „Änderungen“, daneben das gewählte Kapitel. Was
 * hier steht, kommt aus dem Repo des Widgets — es ist so aktuell wie dessen
 * letzter Release und ohne die Staffbase-Seite drumherum verständlich.
 */

import React, { useEffect, useMemo, useState } from "react";

import { installedWidgets } from "@shared/docs/discovery";
import { ChangelogView } from "./changelog-view";
import { ChangelogVersion, LoadedDocs, loadChangelog, loadDocs, loadVersion, pickLanguage } from "./docs-source";
import { labelsFor, LABEL_LANGUAGES } from "./labels";
import { LoadingSurface } from "./loading-surface";
import { MarkdownPage } from "./markdown-page";

export interface DocsReaderProps {
  /** Der Name des Widgets (`hero-slider-widget`); leer heißt „nichts gewählt“. */
  widgetName: string | null;
  /** Sprachen der Nutzerin, wichtigste zuerst (`documentLocales()`). */
  locales: readonly string[];
}

type ReaderState =
  | { status: "loading" }
  | { status: "not-installed" }
  | { status: "no-docs" }
  | { status: "ready"; docs: LoadedDocs; changelog: ChangelogVersion[]; version: string | null };

/** Das Kapitel aus `docs/changelog.json`; kein Manifest-Kapitel heißt so. */
export const CHANGES_CHAPTER = "__changes__";

interface Chapter {
  id: string;
  title: string;
  file?: string;
}

function useReaderState(widgetName: string | null, locales: readonly string[]): ReaderState {
  const [state, setState] = useState<ReaderState>({ status: "loading" });
  const localesKey = locales.join(",");

  useEffect(() => {
    if (!widgetName) return;
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      const widget = (await installedWidgets()).find((candidate) => candidate.name === widgetName);
      if (!widget) return { status: "not-installed" } as const;
      const [docs, changelog, version] = await Promise.all([
        loadDocs(widget.root, locales),
        loadChangelog(widget.root),
        loadVersion(widget.root),
      ]);
      return docs ? ({ status: "ready", docs, changelog, version } as const) : ({ status: "no-docs" } as const);
    })().then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
    // `locales` zählt mit seinem Inhalt (`localesKey`), nicht mit seiner Identität.
  }, [widgetName, localesKey]);

  return state;
}

export function DocsReader({ widgetName, locales }: DocsReaderProps): React.JSX.Element {
  const state = useReaderState(widgetName, locales);
  const [selected, setSelected] = useState<string | null>(null);

  const language = state.status === "ready" ? state.docs.language : pickLanguage(locales, LABEL_LANGUAGES);
  const labels = labelsFor(language);

  const chapters = useMemo<Chapter[]>(() => {
    if (state.status !== "ready") return [];
    const pages = state.docs.manifest.pages.map((page) => ({ id: page.id, title: page.title, file: page.file }));
    return state.changelog.length > 0 ? [...pages, { id: CHANGES_CHAPTER, title: labels.changes }] : pages;
  }, [state, labels]);

  // Ein anderes Widget oder eine andere Sprache beginnt wieder beim ersten Kapitel.
  useEffect(() => setSelected(null), [widgetName, language]);

  if (!widgetName) return <p className="docs-app__status">{labels.noWidget}</p>;
  if (state.status === "loading") return <LoadingSurface label={labels.loading} />;
  if (state.status === "not-installed") return <p className="docs-app__status">{labels.notInstalled(widgetName)}</p>;
  if (state.status === "no-docs") return <p className="docs-app__status">{labels.noDocs}</p>;

  const current = chapters.find((chapter) => chapter.id === selected) ?? chapters[0];
  const openFile = (file: string): boolean => {
    const target = chapters.find((chapter) => chapter.file === file);
    if (target) setSelected(target.id);
    return Boolean(target);
  };

  return (
    <div className="docs-app" lang={language}>
      <nav className="docs-app__sidebar" aria-label={labels.chapters}>
        <ul className="docs-app__page-list">
          {chapters.map((chapter) => {
            const active = chapter.id === current?.id;
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  className={`docs-app__nav-button${active ? " docs-app__nav-button--active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSelected(chapter.id)}
                >
                  {chapter.title}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="docs-app__content">
        {current?.id === CHANGES_CHAPTER ? (
          <ChangelogView versions={state.changelog} labels={labels} language={language} />
        ) : current?.file ? (
          <MarkdownPage
            url={`${state.docs.baseUrl}/${current.file}`}
            loadingLabel={labels.pageLoading}
            errorLabel={labels.pageError}
            onChapterLink={openFile}
          />
        ) : (
          <p className="docs-app__status">{labels.noDocs}</p>
        )}
        {state.version && <p className="docs-app__version">{labels.version(state.version)}</p>}
      </div>
    </div>
  );
}
