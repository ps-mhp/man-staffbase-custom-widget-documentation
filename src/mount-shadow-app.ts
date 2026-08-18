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
 * Widgets embedded as live examples (see `live-example.tsx`) inject their
 * own CSS by appending a `<style>` (or, less commonly, a `<link
 * rel="stylesheet">`) tag to the *global* `document.head` — e.g.
 * `podcast-display-widget`'s `ensureStyles()`. That is correct and
 * sufficient for a normal content page, but this docs app renders every
 * embedded widget's light DOM *inside its own shadow root*: a shadow
 * boundary is specifically designed to block outside stylesheets from
 * cascading in, so a widget mounted here would otherwise render completely
 * unstyled even though the exact same markup looks right on a real page.
 *
 * Rather than special-case every widget's own styling mechanism, this
 * mirrors any `<style>`/stylesheet `<link>` added to `document.head` into
 * the given shadow root too, live, via a `MutationObserver` — plus whatever
 * was already there before the observer started. Each source node is
 * mirrored at most once (`mirroredHeadNodes`), keyed by shadow root, so a
 * second example in the same shadow root does not duplicate the copies, and
 * remounting (`mountShadowApp` is idempotent) does not re-observe.
 */
const STYLE_MIRROR_SELECTOR = "style, link[rel='stylesheet']";
const mirroredShadowRoots = new WeakSet<ShadowRoot>();

function isStyleMirrorCandidate(node: Node): node is HTMLStyleElement | HTMLLinkElement {
  return (
    node instanceof HTMLStyleElement ||
    (node instanceof HTMLLinkElement && node.rel === "stylesheet")
  );
}

function mirrorHeadStylesInto(shadowRoot: ShadowRoot): void {
  if (mirroredShadowRoots.has(shadowRoot)) {
    return;
  }
  mirroredShadowRoots.add(shadowRoot);

  const mirrored = new WeakSet<Node>();
  const mirror = (node: Node): void => {
    if (mirrored.has(node) || !isStyleMirrorCandidate(node)) {
      return;
    }
    mirrored.add(node);
    shadowRoot.insertBefore(node.cloneNode(true), shadowRoot.firstChild);
  };

  document.head.querySelectorAll(STYLE_MIRROR_SELECTOR).forEach(mirror);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(mirror);
    }
  });
  observer.observe(document.head, { childList: true });
}

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

  mirrorHeadStylesInto(shadowRoot);

  return mountPoint;
}
