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

### `createRoute<P, Q>(path, config): TypedRoute<P, Q>`

Declares a typed route in one place. The returned value is callable as a JSX component (render it directly inside `<Router>`) and carries phantom `P` (params) and `Q` (query) types that `useParams(route)` / `useQuery(route)` read to recover the shape at the call site without a generic argument.

```ts
// P inferred from the path literal via PathParams<Path>
const ProjectEditRoute = createRoute(
  '/projects/:projectId/edit',
  { component: EditProjectPage, load: projectEditLoader }
)

// Explicit generics when there are no params or a query shape to type
const LoginRoute = createRoute<{}, { redirect?: string }>(
  '/login',
  { component: LoginPage }
)
```

**`config` (`CreateRouteConfig`)**

| Key | Type | Description |
|-----|------|-------------|
| `component` | `Component` | Component rendered when the route matches. |
| `beforeEnter` | `RouteGuard` | Guard called before activation. |
| `load` | `(params, query) => Promise<unknown>` | Async loader; result via `useRouteData()`. |
| `transition` | `string` | View-transition group name; typically set on a layout route. |

The first overload infers `P` from the path literal; the second accepts explicit `<P, Q>` generics. Children (for layout routes) are declared at the JSX usage site, not in `config`. Raw `<Route>` and `createRoute` components can be mixed in the same `<Router>` tree.

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
router.setQuery({ q: 'shoes' })              // filter/search — no remount
```

Throws if called outside a `<Router>`.

**`setQuery(patch, options?): void`**

Synchronously updates the URL query string and the reactive `location.query` **without** running guards or loaders and without remounting the route — the right tool for filters and live search where `navigate()` would tear down the route subtree and lose input focus.

```ts
router.setQuery({ q: e.currentTarget.value })   // replaceState (default)
router.setQuery({ status: 'archived' }, { push: true })  // adds a history entry
router.setQuery({ category: null })             // null/undefined deletes the key
```

| Param | Type | Description |
|-------|------|-------------|
| `patch` | `Record<string, string \| null \| undefined>` | Keys to set; `null`/`undefined` deletes. |
| `options.push` | `boolean` | Use `pushState` instead of the default `replaceState`. |

Declare query-reactive data at the fetch site — `useResource(fn, () => location.query.key)` — not via a loader, so it stays out of the routing lifecycle. See the [routing guide](../guide/routing.md#updating-the-query-without-re-running-the-route) and the STW075 footgun.

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

### `useParams(route)` / `useParams<T>(): T`

Returns the route parameter map for the current route. Prefer passing a `createRoute` route for value-typed access with no annotation; fall back to the generic form for raw `<Route>` definitions.

```ts
const { id } = useParams(UserRoute)        // value-typed from the route
const { id } = useParams<{ id: string }>() // raw-route form
```

---

### `useQuery(route)` / `useQuery<T>(): T`

Returns the parsed query string for the current URL. Same two forms as `useParams`.

```ts
const { tab, page } = useQuery(SettingsRoute)
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

### `useNavigationStatus(): NavigationStatus`

Returns a reactive object describing the in-flight (or last-completed) navigation. Use this for progress indicators, optimistic UI, or to branch CSS/behavior on what kind of navigation happened.

```ts
const status = useNavigationStatus()

effect(() => {
  if (status.phase === 'loading') showProgressBar()
  else hideProgressBar()
})
```

**`NavigationStatus` fields**

| Field | Type | Description |
|---|---|---|
| `phase` | `'idle' \| 'matching' \| 'guarding' \| 'loading' \| 'committing' \| 'error'` | Lifecycle of the in-flight navigation. |
| `from` | `string \| undefined` | Source URL of the in-flight navigation. |
| `to` | `string \| undefined` | Destination URL of the in-flight navigation. |
| `kind` | `'push' \| 'replace' \| 'traverse' \| 'reload' \| undefined` | What kind of URL operation triggered this navigation. Mirrors the Navigation API spec. |
| `routeDirection` | `'forward' \| 'back' \| 'default' \| 'same' \| undefined` | Structural direction through the route tree. See the [routing guide](../guide/routing.md#view-transitions-and-scroll) for the full table of cases. |

Both `kind` and `routeDirection` are also relayed to View Transitions as `stewie-kind-{kind}` and `stewie-direction-{direction}` types so you can branch in CSS without touching component code. See the [View Transitions and scroll](../guide/routing.md#view-transitions-and-scroll) section of the routing guide.

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

## `createSsrRouter(url, routes): Promise<Router>`

Runs route guards and data loaders for the given URL on the server, returning a pre-configured `Router`. Pass it to `<Router router={ssrRouter}>` so the render uses the correct location and pre-loaded route data.

Throws `RedirectError` if a `beforeEnter` guard returns a redirect URL.

```ts
import { createSsrRouter, RedirectError } from '@stewie-js/router'

try {
  const ssrRouter = await createSsrRouter(req.url, routeChildren)
  const { html } = await renderToString(
    jsx(Router, { router: ssrRouter, children: routeChildren })
  )
  return new Response(html, { headers: { 'content-type': 'text/html' } })
} catch (err) {
  if (err instanceof RedirectError) {
    return new Response(null, { status: 302, headers: { location: err.location } })
  }
  throw err
}
```

See the [SSR guide](../guide/ssr.md#route-guards-and-data-loading-during-ssr) for a complete example.

---

## `class RedirectError`

Thrown by `createSsrRouter` when a `beforeEnter` guard returns a redirect URL.

| Property | Description |
|----------|-------------|
| `location` | The redirect target URL. |

---

## `createRouter(initialUrl?): Router`

Creates a router instance directly, without the `<Router>` component.

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
