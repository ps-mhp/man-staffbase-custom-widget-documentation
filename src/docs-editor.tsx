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
 * Der Rumpf des Fensters „Widget wählen“: eine Auswahl aus den installierten
 * Widgets und darunter, was das gewählte Widget über sich sagt (Symbol,
 * Titel, Kurzbeschreibung aus seiner Doku). Nur im Studio nachgeladen
 * (`docs-dialog.tsx`), er bringt `@man/config-ui` mit.
 */

import * as React from "react";
import { CatalogSelect } from "@man/config-ui/form/catalog-select";
import { FormSection } from "@man/config-ui/form/form-section";
import { ConfigWorkspace } from "@man/config-ui/layout/config-workspace";
import { useConfigShell } from "@man/config-ui/shell/shell-context";

import { installedWidgets } from "@shared/docs/discovery";
import type { DocsManifest } from "@shared/docs/types";
import type { DocsChoice } from "./docs-choice";
import { WIDGET_ISSUE, validateDocsChoice } from "./docs-choice";

export interface DocsEditorProps {
  value: DocsChoice;
  onChange: (value: DocsChoice) => void;
}

export interface CatalogEntry {
  id: string;
  title: string;
  summary: string;
  iconUrl: string;
  hasDocs: boolean;
}

async function fetchManifest(root: string): Promise<DocsManifest | null> {
  try {
    const response = await fetch(`${root}/docs/manifest.json`);
    return response.ok ? ((await response.json()) as DocsManifest) : null;
  } catch {
    return null;
  }
}

/** Die installierten Widgets mit Titel und Kurzbeschreibung aus ihrer Doku, nach Titel sortiert. */
export async function loadCatalog(): Promise<CatalogEntry[]> {
  const widgets = await installedWidgets();
  const entries = await Promise.all(
    widgets.map(async (widget): Promise<CatalogEntry> => {
      const manifest = await fetchManifest(widget.root);
      return {
        id: widget.name,
        title: manifest?.title ?? widget.name,
        summary: manifest?.summary ?? "",
        iconUrl: widget.iconUrl,
        hasDocs: manifest !== null,
      };
    }),
  );
  return [...entries].sort((a, b) => a.title.localeCompare(b.title, "de"));
}

function useCatalog(): CatalogEntry[] | null {
  const [catalog, setCatalog] = React.useState<CatalogEntry[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void loadCatalog().then((entries) => {
      if (!cancelled) setCatalog(entries);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return catalog;
}

function SelectedWidget({ entry }: { entry: CatalogEntry }): React.ReactElement {
  return (
    <div className="flex items-start gap-4 rounded-md border border-border bg-background p-4" data-testid="docs-selected">
      <img src={entry.iconUrl} alt="" aria-hidden="true" className="size-10 shrink-0" />
      <div className="min-w-0">
        <p className="font-bold">{entry.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {entry.hasDocs ? entry.summary : "Für dieses Widget gibt es noch keine Dokumentation."}
        </p>
      </div>
    </div>
  );
}

export function DocsEditor({ value, onChange }: DocsEditorProps): React.ReactElement {
  const catalog = useCatalog();
  const { issuesVisible } = useConfigShell();
  const issue = issuesVisible && validateDocsChoice(value).some((found) => found.id === WIDGET_ISSUE);
  const selected = catalog?.find((entry) => entry.id === value.widget) ?? null;
  const unknown = catalog !== null && value.widget !== null && selected === null;

  return (
    <ConfigWorkspace>
      <div className="flex max-w-[720px] flex-col gap-6 px-10 pt-6 pb-12" data-testid="docs-editor">
        <FormSection title="Inhalt">
          <CatalogSelect
            label="Widget"
            required
            hint="Der Block zeigt die Dokumentation dieses Widgets, immer im Stand seines letzten Releases."
            error={issue ? "Bitte ein Widget wählen." : undefined}
            options={(catalog ?? []).map((entry) => ({ id: entry.id, title: entry.title }))}
            loading={catalog === null}
            value={value.widget}
            placeholder={unknown ? `${value.widget} (nicht installiert)` : "Widget wählen …"}
            onSelect={(widget) => onChange({ widget })}
            data-testid="docs-widget-select"
          />
          {selected && <SelectedWidget entry={selected} />}
        </FormSection>
      </div>
    </ConfigWorkspace>
  );
}
