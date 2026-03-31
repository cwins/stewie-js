// effects.ts — effect flushing utilities

// Wait for all pending reactive effects and microtasks to settle.
// Stewie's effects are synchronous — they run immediately when a signal changes.
// This function yields to the event loop so any async downstream work
// (Promise callbacks, queued microtasks) has a chance to complete.
// Call it after mutating reactive state in tests that use async components
// or deferred work.
export async function flushEffects(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
