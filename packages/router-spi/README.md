# @stewie-js/router-spi

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

TypeScript interface definitions for the Stewie router service provider interface. Primarily types — the only runtime export is a `version` constant.

Use `@stewie-js/router` for standard app routing. This package is for router implementers and framework integrations that need to be router-agnostic.

Implement these interfaces to plug a custom router into the Stewie ecosystem, or reference them when building libraries that need to be router-agnostic.

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

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
  navigate(to: string | NavigateOptions): Promise<void> { ... }
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
