# Routing

`@stewie-js/router` provides reactive client-side and SSR routing. The current location is a `store()` — components subscribe only to the specific URL properties they read, so a query string change does not trigger components that only care about the pathname.

---

## Installation

```bash
pnpm add @stewie-js/router
```

---

## Basic setup

Wrap your app in `<Router>` and define routes with `<Route>`:

```tsx
import { Router, Route } from '@stewie-js/router'

function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/users/:id" component={UserDetail} />
    </Router>
  )
}
```

`<Router>` renders the component matched to the current URL and reacts to navigation automatically. In browsers with the Navigation API it intercepts all navigations; otherwise it listens to `popstate`.

Route changes use the View Transitions API when available, giving you smooth animated transitions with zero configuration.

---

## Links

Use `<Link>` for client-side navigation. It renders an `<a>` tag but intercepts clicks to avoid full-page reloads.

```tsx
import { Link } from '@stewie-js/router'

<Link to="/about">About</Link>
<Link to="/dashboard" replace>Dashboard</Link>
```

Modifier key clicks (Ctrl, Cmd, Alt, Shift) pass through to the browser so users can open links in new tabs.

---

## Programmatic navigation

```ts
import { useRouter } from '@stewie-js/router'

function LogoutButton() {
  const router = useRouter()

  return (
    <button onClick={() => router.navigate('/login')}>
      Log out
    </button>
  )
}
```

`navigate` accepts a string URL or an options object:

```ts
router.navigate('/dashboard')
router.navigate({ to: '/login', replace: true })
router.back()
router.forward()
```

---

## Route parameters

Access the current route's parameters with `useParams`. Parameters are the `:name` segments in the route path.

```tsx
import { useParams } from '@stewie-js/router'

function UserDetail() {
  const { id } = useParams<{ id: string }>()
  // id is reactive — reading it subscribes to param changes
  return <p>User: {id}</p>
}
```

---

## Query string

```tsx
import { useQuery } from '@stewie-js/router'

function SearchPage() {
  const { q, page } = useQuery<{ q: string; page: string }>()
  return <p>Searching for: {q}</p>
}
```

Because `location` is a store, a component reading only `query.q` is not notified when `query.page` changes.

---

## Route guards

A guard runs before a route activates. Return `true` to allow navigation or a URL string to redirect.

```ts
import type { RouteGuard } from '@stewie-js/router'

const requireAuth: RouteGuard = async (to, from) => {
  const ok = await checkSession()
  return ok ? true : `/login?next=${encodeURIComponent(to)}`
}
```

Attach the guard to a route:

```tsx
<Route path="/dashboard" component={Dashboard} beforeEnter={requireAuth} />
```

Guards also run on browser back/forward navigation, not just programmatic `navigate()` calls.

---

## Route-level data loading

The `load` function on a `<Route>` runs before the component renders. Use it to fetch data that the component needs before showing anything.

```tsx
async function loadUser() {
  const res = await fetch('/api/me')
  return res.json()
}

<Route path="/profile" component={Profile} load={loadUser} />
```

Read the result in the component with `useRouteData`:

```tsx
import { useRouteData } from '@stewie-js/router'

function Profile() {
  const user = useRouteData<User>()
  return <h1>Hello, {user.name}</h1>
}
```

`useRouteData()` is reactive — it updates when navigation loads new data.

---

## Lazy routes

Code-split a route component with `lazy`:

```ts
import { lazy } from '@stewie-js/core'

const Settings = lazy(() => import('./pages/Settings'))
```

```tsx
<Route path="/settings" component={Settings} />
```

The module is fetched on first navigation to the route. The router shows nothing (or the `<Router fallback>` if provided) while loading.

---

## Server-side rendering

For SSR, pass the request URL to `<Router>` as `initialUrl`:

```tsx
// server entry
const { html } = await renderToString(
  <App initialUrl={req.url} />
)
```

```tsx
function App({ initialUrl }: { initialUrl?: string }) {
  return (
    <Router initialUrl={initialUrl}>
      <Route path="/" component={Home} />
      ...
    </Router>
  )
}
```

On the client, `<Router>` reads `window.location` by default so you don't need to pass `initialUrl`.

---

## View Transitions and scroll

Every navigation that commits a new URL runs inside a `document.startViewTransition()` call (where supported), letting you animate the route swap with CSS. The router also takes responsibility for scroll restoration — you don't need to scroll-to-top in `onClick` handlers or hand-roll a back/forward scroll cache.

### What the router writes to `NavigationStatus`

`useNavigationStatus()` (or `useRouter().status`) exposes:

| Field | Values | Source |
|---|---|---|
| `kind` | `'push' \| 'replace' \| 'traverse' \| 'reload'` | The Navigation API spec value for what happened to the URL. `traverse` means back/forward button, programmatic `history.back/forward`, or `navigation.traverseTo()`. |
| `routeDirection` | `'forward' \| 'back' \| 'default' \| 'same'` | Computed from the route tree by comparing source and destination chains. See below. |

`kind` is *mechanical* — what the browser/history did. `routeDirection` is *structural* — where the navigation went in the route tree. They're orthogonal.

### `routeDirection` is structural, not perceptual

`routeDirection` answers "how did we move through the route tree?", not "did the user perceive forward motion?". This is deliberate.

| Navigation | Direction | Why |
|---|---|---|
| `/settings → /settings/account` | `forward` | Destination chain extends the source chain (going deeper). |
| `/settings/account → /settings` | `back` | Source chain extends the destination chain (going up). |
| `/home → /profile` | `default` | Sibling subtrees; neither chain is a prefix of the other. |
| `/settings/account → /settings/billing` | `default` | Sibling routes under a shared layout — neither extends the other. |
| `/products/12345 → /products/98765` | `same` | Same route pattern; only params changed. |
| `/search?q=a → /search?q=b` | `same` | Same route; only query changed. |

> **Heads up.** `/products/12345 → /products/98765` via a "next product" button is `same`, not `forward`. The user perceives forward motion, but the route tree didn't move. If you want a slide animation for paginated detail pages, target `stewie-kind-push` in CSS or animate at the component level inside the route — the router won't infer perceptual direction for you.

### Animating with CSS

Inside `startViewTransition`, the router passes a `types[]` array so you can scope CSS rules. Every navigation emits:

- `stewie-kind-{push|replace|traverse|reload}` — always.
- `stewie-direction-{forward|back|default|same}` — always.
- `stewie-transition-{groupName}` — conditional; see [transition groups](#transition-groups) below.

CSS pattern for direction-aware animation:

```css
/* Default for any navigation: a quick fade. */
::view-transition-old(root),
::view-transition-new(root) {
  animation: stewie-fade 200ms;
}

/* Same-route (params/query change) — kill the animation entirely. */
:active-view-transition-type(stewie-direction-same) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
  }
}

@keyframes stewie-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

### Transition groups

Use `transition` on a layout route to scope a directional animation (e.g. a slide) to navigations that cross into or out of that layout:

```tsx
const SettingsLayoutRoute = createRoute('/settings', {
  component: SettingsShell,
  transition: 'slide'
});
```

The router emits `stewie-transition-{name}` **only when**:
1. Both the source and destination chains include a level with that transition name, AND
2. `routeDirection` is `forward` or `back`.

Sibling tabs under the same layout (`/settings/account → /settings/billing`) have direction `default` and so do not trigger the slide. Param-only changes inside the layout have direction `same`. This is by design: the slide tracks structural movement through the tree.

Cookbook — slides inside a settings shell, fades everywhere else:

```css
/* Slide forward when entering deeper into the settings tree. */
:active-view-transition-type(stewie-transition-slide):active-view-transition-type(stewie-direction-forward) {
  ::view-transition-old(root) { animation: slide-out-left 280ms ease both; }
  ::view-transition-new(root) { animation: slide-in-right 280ms ease both; }
}
/* Slide back when leaving the settings tree. */
:active-view-transition-type(stewie-transition-slide):active-view-transition-type(stewie-direction-back) {
  ::view-transition-old(root) { animation: slide-out-right 280ms ease both; }
  ::view-transition-new(root) { animation: slide-in-left 280ms ease both; }
}

@keyframes slide-in-right  { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes slide-out-left  { from { transform: translateX(0); } to { transform: translateX(-100%); } }
@keyframes slide-in-left   { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes slide-out-right { from { transform: translateX(0); } to { transform: translateX(100%); } }
```

`/settings → /settings/account` slides forward. `/settings/account → /settings` slides back. `/settings/account → /settings/billing` falls through to the global fade. `/home → /profile` falls through to the global fade. No per-link config required.

### `view-transition-name` is the author's responsibility

The router does not auto-scope `view-transition-name`. If you give two elements the same name on the same page, the View Transition will error and skip. When using named transitions for shared-element animation (e.g. a thumbnail morphing into a detail-page hero), generate unique names per element instance:

```tsx
<img view-transition-name={`product-${product.id}`} src={...} />
```

### Scroll restoration

The router sets `history.scrollRestoration = 'manual'` and handles scrolling itself. Defaults:

| Navigation | Behavior |
|---|---|
| Forward (`push` / `replace`) | Scroll to `(0, 0)`. |
| Traverse (back / forward button) | Restore the scroll position saved on the previous entry. |
| Hash navigation (`/page#section`) | Scroll the element with that `id` into view. |
| Reload | No-op — let the browser handle it. |

Scroll work happens inside the View Transition's `update` callback, in the same task as the location update, so the post-commit DOM is scrolled before the animation snapshots its end state.

Opt out per call when you don't want any router-driven scrolling — useful for in-place filters and pagination that should preserve the user's position:

```tsx
router.navigate({ to: nextPageUrl, scroll: false });
```

### Lazy chunks and Suspense

When the destination route is `lazy()`, the router awaits the chunk **before** `startViewTransition` fires, so the new DOM is in place when the transition snapshots its end state. Without that, the transition would snapshot an empty boundary and animate to nothing.

Hover-prefetch on `<Link>` (the default) warms the chunk earlier, so even the first hop is usually instant.

### Redirects

When a `beforeEnter` guard returns a redirect URL, the router re-navigates to the target with `replace: true` semantics — `kind` becomes `'replace'` and `routeDirection` is computed against the redirect destination, not the original target. This prevents history from accumulating `/private → /login` pairs and keeps animations correct (a slide-into-settings should not run if the guard rerouted you to `/login`).

---

## Further reading

- [Router API Reference](../reference/router-api.md) — full API, route matching rules, types
