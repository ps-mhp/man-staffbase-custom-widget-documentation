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

import { mountShadowApp } from "./mount-shadow-app";

describe("mountShadowApp", () => {
  it("attaches an open shadow root containing a style tag with the given css", () => {
    const container = document.createElement("div");

    mountShadowApp(container, ".docs-app { display: flex; }");

    expect(container.shadowRoot).not.toBeNull();
    expect(container.shadowRoot!.mode).toBe("open");
    const style = container.shadowRoot!.querySelector("style");
    expect(style?.textContent).toBe(".docs-app { display: flex; }");
  });

  it("returns a div inside the shadow root to mount React into", () => {
    const container = document.createElement("div");

    const mountPoint = mountShadowApp(container, "");

    expect(mountPoint.tagName).toBe("DIV");
    expect(container.shadowRoot!.contains(mountPoint)).toBe(true);
  });

  it("is idempotent: calling it twice on the same container reuses the existing shadow root", () => {
    const container = document.createElement("div");

    const first = mountShadowApp(container, ".a {}");
    const second = mountShadowApp(container, ".a {}");

    expect(second).toBe(first);
    expect(container.shadowRoot!.querySelectorAll("style")).toHaveLength(1);
  });
});
