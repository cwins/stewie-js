// @stewie-js/router-spi — router interface definitions
export const version = '0.6.0';

export interface ReactiveLocation {
  pathname: string;
  params: Record<string, string>;
  query: Record<string, string>;
  hash: string;
}

export interface NavigateOptions {
  to: string;
  replace?: boolean;
  state?: unknown;
}

export interface RouteMatch {
  pattern: string;
  params: Record<string, string>;
  score: number;
}

export interface StewieRouterSPI {
  readonly location: ReactiveLocation;
  navigate(to: string | NavigateOptions): Promise<void>;
  back(): void;
  forward(): void;
  match(pattern: string): RouteMatch | null;
}
