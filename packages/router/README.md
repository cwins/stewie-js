# @stewie-js/router

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

Reactive URL-as-store routing for Stewie. The current location is a `store()` — components subscribe only to the specific location fields they read, so unrelated URL changes don't trigger unnecessary DOM updates.

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

## Install

```bash
pnpm add @stewie-js/router @stewie-js/core
```

## Basic Usage

```tsx
import { Router, Route, Link } from '@stewie-js/router'

function App() {
  return (
    <Router>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/users/:id" component={UserDetail} />
    </Router>
  )
}
```

## Route Parameters

```tsx
import { useParams } from '@stewie-js/router'

function UserDetail() {
  const params = useParams<{ id: string }>()
  return <h1>User {params.id}</h1>
}
```

## Query Parameters

```tsx
import { useQuery } from '@stewie-js/router'

function SearchPage() {
  const query = useQuery<{ q: string; page: string }>()
  return <p>Searching for: {query.q}</p>
}
```

## Programmatic Navigation

```tsx
import { useRouter } from '@stewie-js/router'

function MyComponent() {
  const router = useRouter()

  return (
    <button onClick={() => router.navigate('/dashboard')}>
      Go to Dashboard
    </button>
  )
}
```

## Route Guards

Use `beforeEnter` to protect routes. Return `true` to allow navigation, or a path string to redirect.

```tsx
<Route
  path="/settings"
  component={Settings}
  beforeEnter={async (to, from) => {
    if (!isAuthenticated()) return '/login'
    return true
  }}
/>
```

## Data Loading

Use `load` to fetch data before a route renders. Read it inside the component with `useRouteData()`.

```tsx
<Route
  path="/users/:id"
  component={UserDetail}
  load={async () => {
    const user = await fetchUser(router.location.params.id)
    return user
  }}
/>

function UserDetail() {
  const user = useRouteData<User>()
  return <h1>{user.name}</h1>
}
```

## API

| Export | Description |
|---|---|
| `<Router>` | Root router component — provides routing context to children |
| `<Route path pattern component>` | Renders `component` when the current path matches `pattern` |
| `<Link to>` | Accessible anchor tag that navigates without a full page reload |
| `useRouter()` | Returns the router instance with `location`, `navigate()`, `back()`, `forward()` |
| `useLocation()` | Returns the reactive location store (`pathname`, `params`, `query`, `hash`) |
| `useParams<T>()` | Returns the current route params typed as `T` |
| `useQuery<T>()` | Returns the current query parameters typed as `T` |
| `useRouteData<T>()` | Returns the data returned by the current route's `load` function |
| `createRouter()` | Create a router instance manually (useful for SSR) |
| `matchRoute(pattern, pathname)` | Test a pattern against a path, returns `MatchResult` (`{ params, score }`) or `null` |
