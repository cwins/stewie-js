/// <reference types="vite/client" />
// AppShell — persistent chrome (NavBar + content area).
//
// Because the current Router renders only the matched route component
// (not surrounding children), the shell must be part of each page component.
// Rendering AppShell inside each page means it has access to RouterContext
// (provided by Router) via useRouter(), useLocation(), etc.

import type { JSXElement } from '@stewie-js/core';
import { NavBar } from './NavBar.js';

interface AppShellProps {
  children: JSXElement | JSXElement[];
}

export function AppShell({ children }: AppShellProps): JSXElement {
  return (
    <div class="app-shell">
      <NavBar />
      <div class="app-content">
        {children}
      </div>
    </div>
  );
}
