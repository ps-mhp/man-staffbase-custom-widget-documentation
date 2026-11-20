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

/** Die festen Texte des Readers in den Sprachen der Doku; fehlt eine, gilt Englisch. */
export interface ReaderLabels {
  chapters: string;
  changes: string;
  added: string;
  fixed: string;
  version: (version: string) => string;
  loading: string;
  pageLoading: string;
  pageError: string;
  noDocs: string;
  notInstalled: (name: string) => string;
  noWidget: string;
}

const LABELS: Record<string, ReaderLabels> = {
  de: {
    chapters: "Kapitel",
    changes: "Änderungen",
    added: "Neu:",
    fixed: "Behoben:",
    version: (version) => `Stand: Version ${version}`,
    loading: "Dokumentation wird geladen …",
    pageLoading: "Seite wird geladen …",
    pageError: "Diese Seite konnte nicht geladen werden.",
    noDocs: "Für dieses Widget gibt es noch keine Dokumentation.",
    notInstalled: (name) => `Das Widget „${name}“ ist in dieser Umgebung nicht installiert.`,
    noWidget: "Kein Widget gewählt. In den Einstellungen des Blocks ein Widget auswählen.",
  },
  en: {
    chapters: "Chapters",
    changes: "Changes",
    added: "New:",
    fixed: "Fixed:",
    version: (version) => `Version ${version}`,
    loading: "Loading documentation …",
    pageLoading: "Loading page …",
    pageError: "This page could not be loaded.",
    noDocs: "There is no documentation for this widget yet.",
    notInstalled: (name) => `The widget “${name}” is not installed in this environment.`,
    noWidget: "No widget selected. Choose one in the block settings.",
  },
  es: {
    chapters: "Capítulos",
    changes: "Cambios",
    added: "Nuevo:",
    fixed: "Corregido:",
    version: (version) => `Versión ${version}`,
    loading: "Cargando documentación …",
    pageLoading: "Cargando página …",
    pageError: "No se pudo cargar esta página.",
    noDocs: "Todavía no hay documentación para este widget.",
    notInstalled: (name) => `El widget «${name}» no está instalado en este entorno.`,
    noWidget: "No se ha seleccionado ningún widget. Elíjalo en la configuración del bloque.",
  },
  fr: {
    chapters: "Chapitres",
    changes: "Modifications",
    added: "Nouveau :",
    fixed: "Corrigé :",
    version: (version) => `Version ${version}`,
    loading: "Chargement de la documentation …",
    pageLoading: "Chargement de la page …",
    pageError: "Impossible de charger cette page.",
    noDocs: "Il n’existe pas encore de documentation pour ce widget.",
    notInstalled: (name) => `Le widget « ${name} » n’est pas installé dans cet environnement.`,
    noWidget: "Aucun widget sélectionné. Choisissez-en un dans les paramètres du bloc.",
  },
  it: {
    chapters: "Capitoli",
    changes: "Modifiche",
    added: "Nuovo:",
    fixed: "Corretto:",
    version: (version) => `Versione ${version}`,
    loading: "Caricamento della documentazione …",
    pageLoading: "Caricamento della pagina …",
    pageError: "Impossibile caricare questa pagina.",
    noDocs: "Non esiste ancora documentazione per questo widget.",
    notInstalled: (name) => `Il widget «${name}» non è installato in questo ambiente.`,
    noWidget: "Nessun widget selezionato. Sceglierne uno nelle impostazioni del blocco.",
  },
  nl: {
    chapters: "Hoofdstukken",
    changes: "Wijzigingen",
    added: "Nieuw:",
    fixed: "Opgelost:",
    version: (version) => `Versie ${version}`,
    loading: "Documentatie wordt geladen …",
    pageLoading: "Pagina wordt geladen …",
    pageError: "Deze pagina kon niet worden geladen.",
    noDocs: "Voor deze widget is nog geen documentatie beschikbaar.",
    notInstalled: (name) => `De widget ‘${name}’ is in deze omgeving niet geïnstalleerd.`,
    noWidget: "Geen widget gekozen. Kies er een in de instellingen van het blok.",
  },
  pl: {
    chapters: "Rozdziały",
    changes: "Zmiany",
    added: "Nowość:",
    fixed: "Poprawiono:",
    version: (version) => `Wersja ${version}`,
    loading: "Ładowanie dokumentacji …",
    pageLoading: "Ładowanie strony …",
    pageError: "Nie udało się załadować tej strony.",
    noDocs: "Dla tego widżetu nie ma jeszcze dokumentacji.",
    notInstalled: (name) => `Widżet „${name}” nie jest zainstalowany w tym środowisku.`,
    noWidget: "Nie wybrano widżetu. Wybierz go w ustawieniach bloku.",
  },
  pt: {
    chapters: "Capítulos",
    changes: "Alterações",
    added: "Novo:",
    fixed: "Corrigido:",
    version: (version) => `Versão ${version}`,
    loading: "A carregar a documentação …",
    pageLoading: "A carregar a página …",
    pageError: "Não foi possível carregar esta página.",
    noDocs: "Ainda não existe documentação para este widget.",
    notInstalled: (name) => `O widget «${name}» não está instalado neste ambiente.`,
    noWidget: "Nenhum widget selecionado. Escolha um nas definições do bloco.",
  },
};

export const LABEL_LANGUAGES: readonly string[] = Object.keys(LABELS);

export const labelsFor = (language: string): ReaderLabels => LABELS[language] ?? LABELS.en;

/** `2026-11-18` → `18.11.2026`; das Format folgt der Sprache. */
export function formatDate(iso: string, language: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" }).format(date);
  } catch {
    return iso;
  }
}
