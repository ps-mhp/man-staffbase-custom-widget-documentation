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

import { create, insert, search, AnyOrama } from "@orama/orama";

export interface SearchDoc {
  widgetName: string;
  pageId: string;
  pageTitle: string;
  content: string;
}

export interface SearchHit {
  widgetName: string;
  pageId: string;
  pageTitle: string;
}

export async function buildSearchIndex(docs: SearchDoc[]): Promise<AnyOrama> {
  const db = create({
    schema: {
      widgetName: "string",
      pageId: "string",
      pageTitle: "string",
      content: "string",
    },
  });

  for (const doc of docs) {
    await insert(db, doc);
  }

  return db;
}

export async function querySearchIndex(db: AnyOrama, term: string): Promise<SearchHit[]> {
  if (term.trim() === "") {
    return [];
  }

  const results = await search(db, {
    term,
    properties: ["pageTitle", "content"],
    limit: 10,
  });

  return results.hits.map((hit) => ({
    widgetName: (hit.document as SearchDoc).widgetName,
    pageId: (hit.document as SearchDoc).pageId,
    pageTitle: (hit.document as SearchDoc).pageTitle,
  }));
}
