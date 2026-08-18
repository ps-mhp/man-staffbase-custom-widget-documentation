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

  describe("mirroring widget-injected head styles", () => {
    afterEach(() => {
      document.head.querySelectorAll("style, link[rel='stylesheet']").forEach((el) => el.remove());
    });

    it("mirrors a <style> already present in document.head at mount time", () => {
      const headStyle = document.createElement("style");
      headStyle.id = "some-embedded-widget-styles";
      headStyle.textContent = ".some-embedded-widget { color: red; }";
      document.head.appendChild(headStyle);

      const container = document.createElement("div");
      mountShadowApp(container, ".docs-app {}");

      const mirrored = container.shadowRoot!.querySelector("#some-embedded-widget-styles");
      expect(mirrored?.textContent).toBe(".some-embedded-widget { color: red; }");
    });

    it("mirrors a <style> added to document.head after mount (e.g. a lazily-loaded widget bundle)", async () => {
      const container = document.createElement("div");
      mountShadowApp(container, ".docs-app {}");

      const headStyle = document.createElement("style");
      headStyle.id = "late-widget-styles";
      headStyle.textContent = ".late-widget { color: blue; }";
      document.head.appendChild(headStyle);

      // MutationObserver callbacks run as a microtask.
      await Promise.resolve();

      const mirrored = container.shadowRoot!.querySelector("#late-widget-styles");
      expect(mirrored?.textContent).toBe(".late-widget { color: blue; }");
    });

    it("does not mirror a <link> that is not a stylesheet", async () => {
      const container = document.createElement("div");
      mountShadowApp(container, ".docs-app {}");

      const link = document.createElement("link");
      link.rel = "icon";
      link.href = "favicon.ico";
      document.head.appendChild(link);
      await Promise.resolve();

      expect(container.shadowRoot!.querySelector("link")).toBeNull();
    });
  });
});
