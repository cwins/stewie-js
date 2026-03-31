// hooks.ts — installs dev hooks into @stewie-js/core

import { __devHooks } from '@stewie-js/core';
import { notifyEffectRun, notifySignalWrite, notifyStoreWrite } from './panel.js';

export function installHooks(): void {
  __devHooks.onEffectRun = notifyEffectRun;
  __devHooks.onSignalWrite = notifySignalWrite;
  __devHooks.onStoreWrite = notifyStoreWrite;
}

export function uninstallHooks(): void {
  delete __devHooks.onEffectRun;
  delete __devHooks.onSignalWrite;
  delete __devHooks.onStoreWrite;
}
