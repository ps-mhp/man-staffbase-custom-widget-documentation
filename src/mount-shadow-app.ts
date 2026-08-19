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

/**
 * The generic head-mirroring above clones `<link>`/`<style>` DOM nodes
 * as-is, which is correct for widget-injected styles (they are plain
 * class-selector rules) but not sufficient for the tenant's MAN-CI branding
 * stylesheet (Studio → Einstellungen → Branding → Custom CSS, served as a
 * `<link>` ending in `custom.css`): that file defines its colour/spacing
 * tokens as CSS custom properties on `:root`, and `:root` never matches
 * anything *inside* a shadow tree (there is no document root element in
 * there), so a mere clone leaves those declarations inert. The custom
 * properties themselves still cross the shadow boundary via normal
 * inheritance from the real `:root`, which covers `man(...)` (`var(--man-x,
 * fallback)`) — but any element-selector rule in that file targeting bare
 * `button`/`a`/`select`/etc. (not a custom property) would still never
 * reach content rendered in this shadow root. Fetching the file's own CSS
 * text and inlining it as a `<style>` sidesteps both problems and does not
 * depend on the mirroring's clone-and-hope-`:root`-matches approach.
 */
const CUSTOM_CSS_HREF_PATTERN = /custom\.css(\?.*)?$/i;
const brandingCssInjectedShadowRoots = new WeakSet<ShadowRoot>();
let cachedBrandingCss: Promise<string | null> | null = null;

function findBrandingCssLink(): HTMLLinkElement | null {
  const candidates = document.head.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']");
  return (
    Array.from(candidates).find((link) => CUSTOM_CSS_HREF_PATTERN.test(link.getAttribute("href") ?? "")) ?? null
  );
}

async function fetchBrandingCss(): Promise<string | null> {
  const link = findBrandingCssLink();
  if (!link?.href) {
    return null;
  }
  try {
    const response = await fetch(link.href, { credentials: "include" });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    // No network / CORS-restricted host / running in a test environment
    // without `fetch` mocked — fail soft, the generic head-mirroring above
    // still covers plain class-selector widget styles either way.
    return null;
  }
}

function injectBrandingCssInto(shadowRoot: ShadowRoot): void {
  if (brandingCssInjectedShadowRoots.has(shadowRoot)) {
    return;
  }
  brandingCssInjectedShadowRoots.add(shadowRoot);

  cachedBrandingCss ??= fetchBrandingCss();
  cachedBrandingCss
    .then((css) => {
      if (!css) {
        return;
      }
      const style = document.createElement("style");
      style.setAttribute("data-docs-app-branding-css", "");
      style.textContent = css;
      shadowRoot.insertBefore(style, shadowRoot.firstChild);
    })
    .catch(() => {
      // Already handled inside fetchBrandingCss; nothing to do here.
    });
}

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
  injectBrandingCssInto(shadowRoot);

  return mountPoint;
}
