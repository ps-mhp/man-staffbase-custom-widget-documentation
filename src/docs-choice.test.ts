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

import { configurationSchema, WIDGET_ATTRIBUTE } from "./configuration-schema";
import { docsChoiceStatus, parseDocsChoice, serializeDocsChoice, validateDocsChoice } from "./docs-choice";

describe("docs-widget attribute", () => {
  it("is the only schema field, prefixed so other widgets' editors never claim it", () => {
    expect(Object.keys(configurationSchema.properties ?? {})).toEqual([WIDGET_ATTRIBUTE]);
    expect(WIDGET_ATTRIBUTE).toBe("docs-widget");
  });
});

describe("docs choice", () => {
  it("round-trips a widget name through the attribute", () => {
    expect(parseDocsChoice(" hero-slider-widget ")).toEqual({ widget: "hero-slider-widget" });
    expect(serializeDocsChoice({ widget: "hero-slider-widget" })).toBe("hero-slider-widget");
  });

  it("treats empty or malformed values as no choice", () => {
    expect(parseDocsChoice("")).toEqual({ widget: null });
    expect(parseDocsChoice("../x")).toEqual({ widget: null });
    expect(serializeDocsChoice({ widget: null })).toBe("");
  });

  it("requires a widget and reports a change", () => {
    expect(validateDocsChoice({ widget: null })).toHaveLength(1);
    expect(validateDocsChoice({ widget: "table-widget" })).toEqual([]);
    expect(docsChoiceStatus({ widget: "a" }, { widget: "b" })).toBe("Widget geändert");
    expect(docsChoiceStatus({ widget: "a" }, { widget: "a" })).toBeUndefined();
  });
});
