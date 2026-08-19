/*!
 * Copyright 2026, Staffbase SE and contributors.
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

import { startWidget } from "@shared/dev-mode/start-widget";
import { setPublicPathFromBundle } from "@shared/public-path";

// Must run before any dynamic `import()`, so that lazily loaded chunks come
// from the CDN the bundle was served from and not from the hosting page.
setPublicPathFromBundle("custom-widget-documentation.js");
import React from "react";
import ReactDOM from "react-dom/client";

import { BlockFactory, BlockDefinition, ExternalBlockDefinition, BaseBlock } from "widget-sdk";
import { configurationSchema, uiSchema } from "./configuration-schema";
import { DocsApp } from "./docs-app";
import { mountShadowApp } from "./mount-shadow-app";
import docsAppCss from "./styles/docs-app.scss";
import icon from "../resources/custom-widget-documentation.svg";
import pkg from "../package.json";

/** No configuration: the widget discovers everything it renders at runtime. */
const widgetAttributes: string[] = [];

const factory: BlockFactory = (BaseBlockClass, _widgetApi) => {
  return class CustomWidgetDocumentationBlock extends BaseBlockClass implements BaseBlock {
    private _root: ReactDOM.Root | null = null;

    public renderBlock(container: HTMLElement): void {
      const mountPoint = mountShadowApp(container, docsAppCss);

      // The SDK is assumed to pass the same container for the life of the
      // block, and mountShadowApp is idempotent, so the root itself is only
      // created once too.
      this._root ??= ReactDOM.createRoot(mountPoint);
      this._root.render(<DocsApp />);
    }

    public unmountBlock(_container: HTMLElement): void {
      this._root?.unmount();
      this._root = null;
    }

    public static get observedAttributes(): string[] {
      return widgetAttributes;
    }

    public attributeChangedCallback(...args: [string, string | undefined, string | undefined]): void {
      super.attributeChangedCallback.apply(this, args);
    }
  };
};

const blockDefinition: BlockDefinition = {
  name: "custom-widget-documentation",
  factory: factory,
  attributes: widgetAttributes,
  blockLevel: "block",
  configurationSchema: configurationSchema,
  uiSchema: uiSchema,
  label: "Widget-Dokumentation",
  iconUrl: icon,
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: pkg.author,
  version: pkg.version,
};

// Registration runs through `startWidget`, which first asks whether a local
// development server serves this widget. On virtually every browser the answer
// is no and this registers immediately; on the developer's machine the local
// bundle takes over and registers instead. Only ever one of the two, a block
// name cannot be claimed twice.
void startWidget({
  name: "custom-widget-documentation",
  version: pkg.version,
  register: () => window.defineBlock(externalBlockDefinition),
});
