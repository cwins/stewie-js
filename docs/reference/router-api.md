# Router API Reference

`@stewie-js/router` provides reactive URL-as-store routing. The current location is a `store()` — components subscribe only to the specific properties they read, so a query string change does not affect components that never read `router.location.query`.

---

## Components

### `<Router initialUrl? fallback?>`

Sets up routing for its subtree. Accepts `<Route>` children that define the route table and renders the component matched to the current URL.

```tsx
import { Router, Route } from '@stewie-js/router'

<Router>
  <Route path="/" component={Home} />
  <Route path="/about" component={About} />
  <Route path="/users/:id" component={UserDetail} />
</Router>
```

| Prop | Type | Description |
|------|------|-------------|
| `children` | `JSXElement \| JSXElement[]` | `<Route>` elements defining the route table. |
| `initialUrl` | `string` | Starting URL. Defaults to `window.location` in the browser, `'/'` on the server. |
| `fallback` | `JSXElement` | Rendered while the initial route's guard or data loader is resolving. Defaults to nothing. |

In the browser, `<Router>` reacts to back/forward navigation automatically. It uses the Navigation API when available and falls back to the History API. Route changes trigger View Transitions when the browser supports them.

---

### `<Route path component beforeEnter? load?>`

Declares a route mapping inside a `<Router>`. This component is never rendered directly — `Router` scans its children for `Route` descriptors to build the route table.

```tsx
<Route
  path="/users/:id"
  component={UserDetail}
  beforeEnter={requireAuth}
  load={loadUserData}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `path` | `string` | Route path. Supports static segments (`/about`), parameters (`/users/:id`), and wildcards. |
| `component` | `Component` | The component to render when this route matches. |
| `beforeEnter` | `RouteGuard` | Guard called before activation. See [Route Guards](#route-guards). |
| `load` | `() => Promise<unknown>` | Async data loader. Runs before the component renders; result is available via `useRouteData()`. |

---

### `<Link to replace? class?>`

Client-side navigation anchor. Prevents full-page reloads and uses `router.navigate()` to handle the click. Falls back to a plain `<a href>` when used outside a `<Router>` or during SSR.

Modifier key clicks (Ctrl, Cmd, Alt, Shift) are passed through to the browser so the user can open in new tab, etc.

```tsx
<Link to="/about">About</Link>
<Link to="/dashboard" replace>Dashboard</Link>
```

| Prop | Type | Description |
|------|------|-------------|
| `to` | `string` | Target URL. |
| `replace` | `boolean` | Replace the current history entry instead of pushing. |
| `class` | `string` | CSS class on the rendered `<a>`. |

---

## Hooks

Hooks must be called inside a component that is rendered within a `<Router>`.

---

### `useRouter(): Router`

Returns the router instance. Useful for programmatic navigation.

```ts
const router = useRouter()
router.navigate('/login')
router.navigate({ to: '/dashboard', replace: true })
router.back()
router.forward()
```

Throws if called outside a `<Router>`.

---

### `useLocation(): RouterStore`

Returns the reactive location store. All properties are reactive — reading them inside an `effect` or `computed` registers a subscription.

```ts
const location = useLocation()

// subscribe to pathname changes
effect(() => {
  console.log('navigated to', location.pathname)
})
```

**`RouterStore` properties**

| Property | Type | Description |
|----------|------|-------------|
| `pathname` | `string` | Current path, e.g. `'/users/42'`. |
| `params` | `Record<string, string>` | Extracted route parameters, e.g. `{ id: '42' }`. |
| `query` | `Record<string, string>` | Parsed query string, e.g. `{ tab: 'settings' }`. |
| `hash` | `string` | URL hash without the `#`, e.g. `'section-2'`. |

Because `location` is a `store()`, fine-grained subscriptions apply. A component reading only `location.pathname` is not notified when `location.query` changes.

---

### `useParams<T>(): T`

Returns the route parameter map for the current route. Generic for typed access.

```ts
const { id } = useParams<{ id: string }>()
```

---

### `useQuery<T>(): T`

Returns the parsed query string for the current URL. Generic for typed access.

```ts
const { tab, page } = useQuery<{ tab: string; page: string }>()
```

---

### `useRouteData<T>(): T`

Returns the data resolved by the current route's `load()` function. Reactive — re-reads when navigation loads new data.

```ts
const user = useRouteData<User>()
```

Returns `undefined` if the current route has no `load()` function.

---

## Route Guards

A guard is a function called before a route is activated. Return `true` to allow navigation, or a URL string to redirect instead.

```ts
import type { RouteGuard } from '@stewie-js/router'

const requireAuth: RouteGuard = async (to, from) => {
  const authenticated = await checkSession()
  return authenticated ? true : '/login'
}
```

Guards receive the destination URL as `to` and the current URL as `from`. The guard may be synchronous or async.

```tsx
<Route path="/admin" component={Admin} beforeEnter={requireAuth} />
```

If a guard redirects, the target URL goes through its own guards and loaders before rendering.

---

## `createRouter(initialUrl?): Router`

Creates a router instance directly, without the `<Router>` component. Useful for server-side rendering where you need a router instance before mounting.

```ts
import { createRouter } from '@stewie-js/router'

const router = createRouter('/users/42')
```

Returns a `Router` instance with `navigate`, `back`, `forward`, `match`, and a reactive `location` store.

In most cases you should use `<Router>` instead, which manages the router's lifecycle automatically.

---

## Route Matching

Routes are matched by specificity. Static segments score higher than parameters.

| Pattern | Matches |
|---------|---------|
| `/about` | `/about` |
| `/users/:id` | `/users/42`, `/users/alice` |
| `/users/:id/posts` | `/users/42/posts` |

When multiple routes could match, the highest-scoring route wins. Route order does not matter.
