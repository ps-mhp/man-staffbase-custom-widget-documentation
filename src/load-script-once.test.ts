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

import { loadScriptOnce } from "./load-script-once";

describe("loadScriptOnce", () => {
  afterEach(() => {
    document.querySelectorAll("script").forEach((el) => el.remove());
  });

  it("appends a script tag and resolves when it loads", async () => {
    const promise = loadScriptOnce("https://cdn.example/widget.js");

    const script = document.querySelector('script[src="https://cdn.example/widget.js"]');
    expect(script).not.toBeNull();

    script!.dispatchEvent(new Event("load"));
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects when the script fails to load", async () => {
    const promise = loadScriptOnce("https://cdn.example/broken.js");

    const script = document.querySelector('script[src="https://cdn.example/broken.js"]');
    script!.dispatchEvent(new Event("error"));

    await expect(promise).rejects.toThrow();
  });

  it("does not append a second script tag for the same src", async () => {
    const first = loadScriptOnce("https://cdn.example/widget.js");
    document.querySelector('script[src="https://cdn.example/widget.js"]')!.dispatchEvent(new Event("load"));
    await first;

    await loadScriptOnce("https://cdn.example/widget.js");

    expect(document.querySelectorAll('script[src="https://cdn.example/widget.js"]')).toHaveLength(1);
  });
});
