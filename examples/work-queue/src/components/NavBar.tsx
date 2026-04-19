/// <reference types="vite/client" />
import type { JSXElement } from '@stewie-js/core';
import { Link } from '@stewie-js/router';
import { useLocation } from '@stewie-js/router';

export function NavBar(): JSXElement {
  const location = useLocation();

  return (
    <nav class="navbar" aria-label="Main navigation">
      <div class="navbar-brand">
        <Link to="/" class="navbar-logo">
          Work Queue
        </Link>
      </div>
      <ul class="navbar-links" role="list">
        <li>
          <span class={() => `navbar-link-wrap${location.pathname === '/' ? ' active' : ''}`}>
            <Link to="/" class="navbar-link">
              Dashboard
            </Link>
          </span>
        </li>
        <li>
          <span class={() => `navbar-link-wrap${location.pathname.startsWith('/projects') ? ' active' : ''}`}>
            <Link to="/projects" class="navbar-link">
              Projects
            </Link>
          </span>
        </li>
        <li>
          <span class={() => `navbar-link-wrap${location.pathname === '/admin' ? ' active' : ''}`}>
            <Link to="/admin" class="navbar-link">
              Admin
            </Link>
          </span>
        </li>
      </ul>
    </nav>
  );
}
