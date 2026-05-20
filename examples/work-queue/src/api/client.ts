// API client foundation for the Work Queue example.
//
// The API client is a thin layer over the mock repo that applies viewer-based
// restrictions at the data boundary — not in the UI. UIs receive only what
// the viewer is allowed to see; sensitive fields are absent from the returned
// shape (enforced by the type system via UserView's discriminated union).
//
// Method signatures are explicit about the viewer: every call takes
// `viewer: Viewer` as its first argument. There is no implicit propagation
// through context in v1. That is deliberate — we want the verbosity of
// passing the viewer around to be felt before we decide whether to abstract
// it (middleware-style cross-cutting concern; CLAUDE.md open decision).
//
// The client simulates network latency with a small delay so loading states
// and Suspense behave realistically. Real fetches have latency; tests that
// want determinism use FIXED_LATENCY_MS via the helpers below.

const DEFAULT_LATENCY_MS = 80;

// Tests override this to 0 for deterministic timing; production runs see the
// realistic delay.
let latencyMs = DEFAULT_LATENCY_MS;

export function _setLatencyForTests(ms: number): void {
  latencyMs = ms;
}

export function _resetLatency(): void {
  latencyMs = DEFAULT_LATENCY_MS;
}

export async function simulateLatency(): Promise<void> {
  if (latencyMs === 0) return;
  await new Promise((resolve) => setTimeout(resolve, latencyMs));
}

// API-layer errors. The status code mirrors HTTP conventions so consumers can
// switch on `err.status` to decide UI behavior (redirect on 401, render 404,
// show generic error on 500, etc.) without parsing error messages.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFound(message: string): ApiError {
  return new ApiError(404, message);
}

export function forbidden(message: string): ApiError {
  return new ApiError(403, message);
}
