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

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownPageProps {
  url: string;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "loaded"; content: string };

export function MarkdownPage({ url }: MarkdownPageProps): React.JSX.Element {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status}`);
        }
        return response.text();
      })
      .then((content) => {
        if (!cancelled) {
          setState({ status: "loaded", content });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.status === "loading") {
    return <p className="docs-app__status">Seite wird geladen …</p>;
  }

  if (state.status === "error") {
    return <p className="docs-app__status docs-app__status--error">Diese Seite konnte nicht geladen werden.</p>;
  }

  return (
    <div className="docs-app__markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.content}</ReactMarkdown>
    </div>
  );
}
