# @stewie-js/devtools

Browser overlay devtools panel for the [Stewie](https://github.com/cwins/stewie-js) framework — similar to TanStack Devtools. Provides a floating panel with tabs for Renders, Stores, and Routes, plus a render highlight feature that flashes DOM nodes when reactive effects fire.

## Install

```bash
pnpm add -D @stewie-js/devtools
```

## Usage

### Option A — In your app entry point

```ts
import { initDevtools } from '@stewie-js/devtools'

if (import.meta.env.DEV) {
  initDevtools()
}
```

### Option B — Auto-injected by the Vite plugin

When using `@stewie-js/vite`, the devtools are automatically injected in development mode — provided `@stewie-js/devtools` is installed in the project. The Vite plugin adds a dynamic import for this package, so it must be resolvable. No other manual setup is needed.

## Keyboard Shortcut

Press **Alt+D** to toggle the devtools panel open/closed.

## Tabs

### Renders

Shows a live log of reactive effect re-runs. Each entry displays the DOM element and attribute that triggered the update. Click any entry to flash-highlight the corresponding element in the viewport.

Includes a toggle to enable/disable the render highlight overlay.

### Stores

Shows a live log of signal and store write events. Each entry displays the new value and a timestamp. Useful for tracking how often and when reactive state changes.

### Routes

Shows the current URL pathname, query parameters, URL hash, and router params (if `@stewie-js/router` is in use). Also displays a navigation history list.

## Render Highlight

When a reactive prop effect re-runs, the affected DOM element is briefly outlined with a blue flash overlay (`rgba(56,189,248,0.25)` fill, `2px` solid outline). This makes it easy to see exactly which parts of the page are updating in response to state changes.

The highlight can be toggled on/off from the Renders tab.

## API

```ts
import { initDevtools, destroyDevtools } from '@stewie-js/devtools'

// Mount the devtools panel
initDevtools()

// Unmount and clean up
destroyDevtools()
```
