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

export function LiveExample({ widgetName, bundleUrl, docsExamplesUrl, example }: LiveExampleProps): JSX.Element {
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

      const element = document.createElement(widgetName);
      for (const [key, value] of Object.entries(resolved!.attributes)) {
        element.setAttribute(key, value);
      }
      container.innerHTML = "";
      container.appendChild(element);
    }

    void mount();
    return () => {
      cancelled = true;
    };
  }, [resolved, bundleUrl, widgetName]);

  if (!resolved) {
    return <p>Beispiel wird geladen …</p>;
  }

  return (
    <div>
      <p>{resolved.title}</p>
      {resolved.isLive ? (
        <div ref={containerRef} />
      ) : (
        <>
          <p>{resolved.unavailableReason}</p>
          <pre>{JSON.stringify(resolved.attributes, null, 2)}</pre>
        </>
      )}
    </div>
  );
}
