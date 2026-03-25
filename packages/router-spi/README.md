# @stewie-js/router-spi

> **Work in progress.** APIs may change between releases.

TypeScript interface definitions for the Stewie router service provider interface. Contains zero runtime code — types only.

Implement these interfaces to plug a custom router into the Stewie ecosystem, or reference them when building libraries that need to be router-agnostic.

Part of the [Stewie](https://github.com/YOUR_ORG/stewie-js) framework.

## Install

```bash
pnpm add @stewie-js/router-spi
```

## Interfaces

```ts
import type { StewieRouterSPI, ReactiveLocation, NavigateOptions, RouteMatch } from '@stewie-js/router-spi'

// Implement this to provide a custom router
class MyRouter implements StewieRouterSPI {
  readonly location: ReactiveLocation  // reactive store — components subscribe to specific properties
  navigate(to: string | NavigateOptions): void { ... }
  back(): void { ... }
  forward(): void { ... }
  match(pattern: string): RouteMatch | null { ... }
}
```

### `ReactiveLocation`

```ts
interface ReactiveLocation {
  pathname: string
  params: Record<string, string>  // current route params (:id, etc.)
  query: Record<string, string>   // parsed search params
  hash: string
}
```

### `NavigateOptions`

```ts
interface NavigateOptions {
  to: string
  replace?: boolean  // replace history entry instead of push
  state?: unknown    // History API state object
}
```

### `RouteMatch`

```ts
interface RouteMatch {
  pattern: string
  params: Record<string, string>
  score: number  // higher = more specific match
}
```
