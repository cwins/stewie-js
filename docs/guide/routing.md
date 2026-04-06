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

## Further reading

- [Router API Reference](../reference/router-api.md) — full API, route matching rules, types
