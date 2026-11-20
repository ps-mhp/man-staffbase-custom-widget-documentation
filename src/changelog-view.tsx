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

import React from "react";

import type { ChangelogVersion } from "./docs-source";
import { formatDate, ReaderLabels } from "./labels";

export interface ChangelogViewProps {
  versions: readonly ChangelogVersion[];
  labels: ReaderLabels;
  language: string;
}

/** Das Kapitel „Änderungen“: je Version ein aufklappbarer Eintrag, die neueste offen. */
export function ChangelogView({ versions, labels, language }: ChangelogViewProps): React.JSX.Element {
  return (
    <div className="docs-app__markdown docs-app__changelog">
      <h1>{labels.changes}</h1>
      {versions.map((version, index) => (
        <details key={version.version} className="docs-app__changelog-version" open={index === 0}>
          <summary>
            <strong>{version.version}</strong>
            {version.date && <span className="docs-app__changelog-date"> · {formatDate(version.date, language)}</span>}
          </summary>
          <ul>
            {version.entries.map((entry, at) => (
              <li key={at}>
                <strong>{entry.type === "feat" ? labels.added : labels.fixed}</strong> {entry.text}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
