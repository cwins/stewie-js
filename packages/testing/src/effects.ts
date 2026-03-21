// effects.ts — effect flushing utilities

// Flush all pending reactive effects synchronously.
// In Stewie's synchronous reactive system, effects run immediately on signal changes.
// This is a no-op for Phase 9 but provides a stable API for framework consumers
// that may be used to compatibility-shim batched-update frameworks like React's act().
export function flushEffects(): void {
  // Effects in Stewie are synchronous — this is a compatibility shim
}
