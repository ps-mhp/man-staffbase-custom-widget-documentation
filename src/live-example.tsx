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

import React, { useEffect, useRef, useState } from "react";

import { resolveExample, ResolvedExample } from "@shared/docs/resolve-example";
import type { DocsExample } from "@shared/docs/types";
import { loadScriptOnce } from "./load-script-once";

export interface LiveExampleProps {
  widgetName: string;
  bundleUrl: string;
  docsExamplesUrl: string;
  example: DocsExample;
}

export function LiveExample({ widgetName, bundleUrl, docsExamplesUrl, example }: LiveExampleProps): React.JSX.Element {
  const [resolved, setResolved] = useState<ResolvedExample | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      if ((example.resolve ?? []).length > 0) {
        try {
          await loadScriptOnce(docsExamplesUrl);
        } catch {
          // Best-effort: resolveExample() itself falls back to "unavailable"
          // when no resolver ends up registered, so a failed script load
          // does not need its own branch here.
        }
      }

      const result = await resolveExample(widgetName, example);
      if (!cancelled) {
        setResolved(result);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [widgetName, docsExamplesUrl, example]);

  useEffect(() => {
    if (!resolved || !resolved.isLive || !containerRef.current) {
      return;
    }

    let cancelled = false;
    const container = containerRef.current;

    async function mount(): Promise<void> {
      await loadScriptOnce(bundleUrl);
      await customElements.whenDefined(widgetName);
      if (cancelled) {
        return;
      }

      container.innerHTML = "";

      const members = resolved!.members;
      if (members) {
        // A Staffbase-shaped section with one column per member — the DOM
        // shape a grouping widget like content-tabs actually reacts to (see
        // `DocsExampleMember`). A bare, single element never leaves its
        // "configuration, not content" placeholder because there is nothing
        // beside it to group with.
        const section = document.createElement("div");
        section.className = "ui-commons__section__wrapper";
        section.style.display = "flex";
        section.style.gap = "1rem";

        for (const member of members) {
          const column = document.createElement("div");
          column.className = "ui-commons__section__column";
          column.style.flex = "1 1 0%";

          const element = document.createElement(widgetName);
          for (const [key, value] of Object.entries(member.attributes)) {
            element.setAttribute(key, value);
          }
          column.appendChild(element);

          if (member.content) {
            const content = document.createElement("p");
            content.textContent = member.content;
            column.appendChild(content);
          }

          section.appendChild(column);
        }

        container.appendChild(section);
        return;
      }

      const element = document.createElement(widgetName);
      for (const [key, value] of Object.entries(resolved!.attributes)) {
        element.setAttribute(key, value);
      }
      container.appendChild(element);
    }

    void mount();
    return () => {
      cancelled = true;
    };
  }, [resolved, bundleUrl, widgetName]);

  if (!resolved) {
    return <p className="docs-app__status">Beispiel wird geladen …</p>;
  }

  return (
    <div className="docs-app__example">
      <p className="docs-app__example-title">{resolved.title}</p>
      {resolved.isLive ? (
        <div className="docs-app__example-embed" ref={containerRef} />
      ) : (
        <>
          <p className="docs-app__status">{resolved.unavailableReason}</p>
          <pre className="docs-app__example-attributes">{JSON.stringify(resolved.attributes, null, 2)}</pre>
        </>
      )}
    </div>
  );
}
