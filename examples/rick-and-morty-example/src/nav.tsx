import type { JSXElement } from '@stewie-js/core';
import { Link, useRouter } from '@stewie-js/router';
import { Icon } from './components/lib/icon.js';
import { cx } from './utils/format.js';

export function Nav(): JSXElement {
  const router = useRouter();

  const isActive = (path: string) => router.location.pathname === path;

  return (
    <header class="topbar">
      <div class="topbar__inner">
        <Link to="/" class="brand">
          <span class="brand__mark">RM</span>
          <span class="brand__text">Stewie Multiverse Guide</span>
        </Link>
        <nav class="topbar__nav">
          <Link to="/" class={cx('nav-link', isActive('/') && 'nav-link--active')}>
            Home
          </Link>
          <Link to="/characters" class={cx('nav-link', isActive('/characters') && 'nav-link--active')}>
            <span class="nav-link__content">
              <Icon name="people" />
              <span>Characters</span>
            </span>
          </Link>
          <Link to="/episodes" class={cx('nav-link', isActive('/episodes') && 'nav-link--active')}>
            <span class="nav-link__content">
              <Icon name="episode" />
              <span>Episodes</span>
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
