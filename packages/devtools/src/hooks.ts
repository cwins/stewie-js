// hooks.ts — installs dev hooks into @stewie-js/core

import { __devHooks } from '@stewie-js/core';
import {
  notifyEffectRun,
  notifySignalWrite,
  notifyStoreWrite,
  setCurrentTrigger,
  onGraphNodeCreate,
  onGraphNodeDispose,
  onGraphDepsUpdate,
} from './panel.js';

export function installHooks(): void {
  __devHooks.onSignalWrite = (value, label) => {
    setCurrentTrigger({ kind: 'signal', value, label });
    notifySignalWrite(value, label);
  };

  __devHooks.onStoreWrite = (path, value) => {
    setCurrentTrigger({ kind: 'store', path, value });
    notifyStoreWrite(path, value);
  };

  __devHooks.onEffectRun = notifyEffectRun;

  __devHooks.onNodeCreate = onGraphNodeCreate;
  __devHooks.onNodeDispose = onGraphNodeDispose;
  __devHooks.onDepsUpdate = onGraphDepsUpdate;
}

export function uninstallHooks(): void {
  delete __devHooks.onEffectRun;
  delete __devHooks.onSignalWrite;
  delete __devHooks.onStoreWrite;
  delete __devHooks.onNodeCreate;
  delete __devHooks.onNodeDispose;
  delete __devHooks.onDepsUpdate;
}
