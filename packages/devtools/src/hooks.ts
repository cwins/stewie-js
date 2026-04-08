// hooks.ts — installs dev hooks into @stewie-js/core

import { __devHooks } from '@stewie-js/core';
import {
  notifyEffectRun,
  notifySignalWrite,
  notifyStoreWrite,
  setCurrentTrigger,
  onGraphNodeCreate,
  onGraphNodeDispose,
  onGraphDepsUpdate
} from './panel.js';

export function installHooks(): void {
  __devHooks.onSignalWrite = (oldValue, newValue, label, caller) => {
    setCurrentTrigger({ kind: 'signal', oldValue, value: newValue, label, caller });
    notifySignalWrite(oldValue, newValue, label, caller);
  };

  __devHooks.onStoreWrite = (path, oldValue, newValue, caller) => {
    setCurrentTrigger({ kind: 'store', path, oldValue, value: newValue, caller });
    notifyStoreWrite(path, oldValue, newValue, caller);
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
