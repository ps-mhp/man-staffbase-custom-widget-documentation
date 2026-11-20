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
 * Der Konfigurationsdialog: ein Fenster „Widget wählen“ am Feld `docs-widget`,
 * nur im eigenen Dialog.
 */

import * as React from "react";
import { BookOpen } from "lucide-react";

import { FieldModalShellOptions, startFieldModalInjector } from "@shared/config-modal";

import { WIDGET_ATTRIBUTE } from "./configuration-schema";
import { DocsChoice, docsChoiceStatus, parseDocsChoice, serializeDocsChoice, validateDocsChoice } from "./docs-choice";

/** Der Editor kommt erst mit dem Dialog: er baut auf `@man/config-ui` und react-aria. */
const LazyDocsEditor = React.lazy(() => import("./docs-editor").then((module) => ({ default: module.DocsEditor })));

const LOADING = <p className="p-6 text-sm text-muted-foreground">Editor wird geladen …</p>;

const HELP = (
  <ul className="flex list-disc flex-col gap-2 pl-5">
    <li>
      Zur Auswahl stehen alle Widgets, die in dieser Umgebung installiert sind. Der Block zeigt deren Dokumentation
      mit eigener Kapitelnavigation.
    </li>
    <li>
      Die Texte kommen aus dem Widget selbst und sind immer auf dem Stand seines letzten Releases — auf der Seite
      lassen sie sich nicht bearbeiten.
    </li>
    <li>Leser:innen sehen die Doku in ihrer Sprache, sofern es eine Übersetzung gibt, sonst auf Deutsch.</li>
  </ul>
);

/** Was der gemeinsame Rahmen vom Doku-Widget wissen muss. Offengelegt für Tests. */
export const docsEditorShell: FieldModalShellOptions<DocsChoice> = {
  widgetName: "Widget-Dokumentation",
  title: "Widget wählen",
  icon: BookOpen,
  help: HELP,
  statusText: docsChoiceStatus,
  validate: validateDocsChoice,
};

/**
 * Wartet auf den Konfigurationsdialog des Widgets und setzt das Fenster an die
 * Stelle von `docs-widget`.
 *
 * @param root der zu beobachtende Teilbaum; standardmäßig das Dokument.
 * @returns eine Funktion, die die Beobachtung beendet und alles abbaut.
 */
export function startDocsDialog(root: ParentNode = document): () => void {
  return startFieldModalInjector<DocsChoice>({
    fieldKey: WIDGET_ATTRIBUTE,
    root,
    reopenLabel: "Widget wählen",
    modalTestId: "docs-editor-modal",
    reopenTestId: "docs-editor-reopen",
    parse: parseDocsChoice,
    serialize: serializeDocsChoice,
    shell: docsEditorShell,
    render: ({ value, onChange }) => (
      <React.Suspense fallback={LOADING}>
        <LazyDocsEditor value={value} onChange={onChange} />
      </React.Suspense>
    ),
  });
}
