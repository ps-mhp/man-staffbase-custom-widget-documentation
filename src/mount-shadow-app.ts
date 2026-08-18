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

const MOUNT_POINT_ATTRIBUTE = "data-docs-app-mount";

/**
 * Attaches an open shadow root to `container` (once), injects `css` as a
 * `<style>` tag inside it, and returns the child `<div>` React should render
 * into. Idempotent because `attachShadow` throws if called a second time on
 * the same element, and `renderBlock` is not guaranteed to run only once.
 */
export function mountShadowApp(container: HTMLElement, css: string): HTMLDivElement {
  const existingRoot = container.shadowRoot;
  if (existingRoot) {
    const existingMount = existingRoot.querySelector<HTMLDivElement>(`[${MOUNT_POINT_ATTRIBUTE}]`);
    if (existingMount) {
      return existingMount;
    }
  }

  const shadowRoot = existingRoot ?? container.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = css;
  shadowRoot.appendChild(style);

  const mountPoint = document.createElement("div");
  mountPoint.setAttribute(MOUNT_POINT_ATTRIBUTE, "");
  shadowRoot.appendChild(mountPoint);

  return mountPoint;
}
