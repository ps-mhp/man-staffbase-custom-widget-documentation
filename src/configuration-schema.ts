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

import { UiSchema } from "@rjsf/utils";
import { JSONSchema7 } from "json-schema";

/**
 * Welches Widget der Block dokumentiert: sein Name, etwa `hero-slider-widget`.
 * Mit Präfix, weil Editoren anderer Widgets sich über `root_<attribut>` in
 * den Dialog hängen, ohne das Widget zu kennen. Gewählt wird im Fenster
 * „Widget wählen“ (`docs-dialog.tsx`); docs-page.mjs setzt es beim Schreiben
 * der Doku-Seiten.
 */
export const WIDGET_ATTRIBUTE = "docs-widget";

/**
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/
 */
export const configurationSchema: JSONSchema7 = {
  properties: {
    [WIDGET_ATTRIBUTE]: {
      type: "string",
      title: "Widget",
      default: "",
    },
  },
};

/**
 * @see https://rjsf-team.github.io/react-jsonschema-form/docs/api-reference/uiSchema
 */
export const uiSchema: UiSchema = {
  [WIDGET_ATTRIBUTE]: {
    "ui:help": "Das Widget wird im Fenster „Widget wählen“ ausgesucht; das Textfeld dahinter ist die Rohfassung.",
  },
};

/** `" hero-slider-widget "` → `hero-slider-widget`; leer oder ungültig → `null`. */
export function readWidgetName(raw: unknown): string | null {
  const name = typeof raw === "string" ? raw.trim() : "";
  return /^[a-z0-9-]+$/.test(name) ? name : null;
}
