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

import css from "./docs-app.scss";

/** Every value the compiled stylesheet gives `property`. */
function valuesOf(property: string): string[] {
  return [...css.matchAll(new RegExp(String.raw`(?<![\w-])${property}:\s*([^;}]+)`, "g"))].map((match) =>
    match[1].trim(),
  );
}

describe("docs-app stylesheet (Craft)", () => {
  it("sets nothing in capitals and tracks nothing", () => {
    expect(css).not.toMatch(/uppercase/);
    expect(valuesOf("letter-spacing").filter((value) => value !== "normal")).toEqual([]);
  });

  it("uses only the Craft faces and weights", () => {
    expect(css).not.toMatch(/MANEurope/i);
    expect(
      valuesOf("font-weight").filter((value) => !/^(400|700|var\(--man-weight-[a-z-]+, (400|700)\))$/.test(value)),
    ).toEqual([]);
  });

  it("draws focus as the Craft outline, not as a box-shadow", () => {
    expect(css).not.toContain("var(--man-focus,");
    expect(css).toContain("outline: var(--man-focus-width, 2px) solid var(--man-focus-color, #3875b2)");
  });

  it("writes error text in the Craft error ink", () => {
    expect(css).toMatch(/\.docs-app__status--error \{\s*color: var\(--man-error-ink, #990000\);/);
  });

  it("keeps the selected navigation entry readable (AA) on its pale red", () => {
    // #E40045 on #FDE2E8 is only ~3.8:1; #AD0040 (`red-hover`) is ~5.9:1.
    const active = /\.docs-app__nav-button--active\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(active).toMatch(/color:\s*var\(--man-red-hover, #ad0040\)\s*!important/);
  });
});
