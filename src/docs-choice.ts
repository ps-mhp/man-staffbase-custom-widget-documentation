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
 * Was das Fenster „Widget wählen“ bearbeitet, mit Prüfung und Status. Liegt
 * im Seitenbündel: der Rahmen braucht es, bevor der Editor nachgeladen ist.
 */

import type { ValidationIssue } from "@man/config-ui/shell/shell-context";

import { readWidgetName } from "./configuration-schema";

export interface DocsChoice {
  widget: string | null;
}

export const WIDGET_ISSUE = "widget";

export const parseDocsChoice = (raw: string): DocsChoice => ({ widget: readWidgetName(raw) });

export const serializeDocsChoice = (choice: DocsChoice): string => choice.widget ?? "";

export function validateDocsChoice(choice: DocsChoice): ValidationIssue[] {
  return choice.widget ? [] : [{ id: WIDGET_ISSUE, message: "Kein Widget gewählt" }];
}

export function docsChoiceStatus(draft: DocsChoice, saved: DocsChoice): string | undefined {
  return draft.widget !== saved.widget ? "Widget geändert" : undefined;
}
