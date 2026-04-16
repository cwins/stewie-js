/// <reference types="vite/client" />
// client.tsx — browser entry point.
//
// Hydrates the server-rendered HTML: attaches reactive effects to existing
// DOM nodes without wiping and re-rendering. The router re-runs guards and
// loaders for subsequent client-side navigations.

import { hydrate } from '@stewie-js/core';
import { App } from './app.js';

hydrate(<App />, document.getElementById('app') ?? document.body);
