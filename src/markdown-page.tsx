/*!
 * Copyright 2026, Staffbase SE and contributors.
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

import React, { useEffect, useState } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { LoadingSurface } from "./loading-surface";

export interface MarkdownPageProps {
  url: string;
  loadingLabel: string;
  errorLabel: string;
  /**
   * Links auf ein anderes Kapitel (`settings.md`, `faq.md#…`) wechseln das
   * Kapitel im Reader statt die Datei zu öffnen. Gibt `true` zurück, wenn
   * die Datei ein Kapitel ist.
   */
  onChapterLink?: (file: string) => boolean;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "loaded"; content: string };

/** `settings.md`, `./faq.md#frage` → `settings.md`, `faq.md`; sonst `null`. */
export function chapterFileOf(href: string | undefined): string | null {
  const match = /^(?:\.\/)?([\w-]+\.md)(?:#.*)?$/.exec(href ?? "");
  return match ? match[1] : null;
}

export function MarkdownPage({ url, loadingLabel, errorLabel, onChapterLink }: MarkdownPageProps): React.JSX.Element {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status}`);
        return response.text();
      })
      .then((content) => {
        if (!cancelled) setState({ status: "loaded", content });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.status === "loading") return <LoadingSurface label={loadingLabel} />;
  if (state.status === "error") return <p className="docs-app__status docs-app__status--error">{errorLabel}</p>;

  const components: Components = {
    a: ({ href, children }) => {
      const file = chapterFileOf(href);
      const external = /^[a-z][a-z0-9+.-]*:/i.test(href ?? "");
      return (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          onClick={(event) => {
            if (file && onChapterLink?.(file)) event.preventDefault();
          }}
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="docs-app__markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {state.content}
      </ReactMarkdown>
    </div>
  );
}
