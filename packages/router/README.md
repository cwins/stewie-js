# @stewie-js/router

> **Work in progress.** APIs may change between releases.

Reactive URL-as-store routing for Stewie. The current location is a `store()` — components subscribe only to the specific properties they read, so changing a query parameter only re-renders components that actually read that parameter.

Part of the [Stewie](https://github.com/YOUR_ORG/stewie-js) framework.

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
| `createRouter()` | Create a router instance manually (useful for SSR) |
| `matchRoute(pattern, pathname)` | Test a pattern against a path, returns params or null |
