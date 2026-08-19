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

import React from "react";

interface LoadingSurfaceProps {
  /**
   * Announced to assistive tech via `role="status"` (a polite live region)
   * while the animation plays. Rendered visually hidden — the shimmering
   * bars already communicate "loading" at a glance for sighted users, but
   * a looping CSS animation has nothing meaningful to expose to a screen
   * reader on its own.
   */
  label: string;
}

/**
 * A full-area ("flächig") pulsing skeleton placeholder shown while docs
 * content is loading, replacing what used to be a single line of static
 * text (`"... wird geladen"`) — far easier to notice at a glance, and
 * gives an immediate visual cue that the widget is actively working
 * rather than looking like it simply failed to render anything.
 */
export function LoadingSurface({ label }: LoadingSurfaceProps): React.JSX.Element {
  return (
    <div className="docs-app__loading" role="status">
      <span className="docs-app__visually-hidden">{label}</span>
      <div className="docs-app__loading-bar docs-app__loading-bar--title" aria-hidden="true" />
      <div className="docs-app__loading-bar" aria-hidden="true" />
      <div className="docs-app__loading-bar" aria-hidden="true" />
      <div className="docs-app__loading-bar docs-app__loading-bar--short" aria-hidden="true" />
    </div>
  );
}
