// jsx-runtime.ts — JSX runtime for @stewie-js/core
// TypeScript calls into these exports when jsxImportSource is @stewie-js/core.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CSSProperties = Record<string, string | number>

export interface HTMLAttributes {
  class?: string | (() => string)
  style?: string | CSSProperties | (() => string)
  id?: string
  children?: JSXElement | JSXElement[] | string | number | null | (() => unknown)
  onClick?: (e: MouseEvent) => void
  onInput?: (e: InputEvent) => void
  onChange?: (e: Event) => void
  onFocus?: (e: FocusEvent) => void
  onBlur?: (e: FocusEvent) => void
  onKeyDown?: (e: KeyboardEvent) => void
  onKeyUp?: (e: KeyboardEvent) => void
  onMouseEnter?: (e: MouseEvent) => void
  onMouseLeave?: (e: MouseEvent) => void
  onSubmit?: (e: SubmitEvent) => void
  ref?: ((el: Element) => void) | { current: Element | null }
  [key: string]: unknown
}

export interface ButtonAttributes extends HTMLAttributes {
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean | (() => boolean)
}

export interface InputAttributes extends HTMLAttributes {
  type?: string
  value?: string | number | (() => string | number)
  checked?: boolean | (() => boolean)
  placeholder?: string
  disabled?: boolean | (() => boolean)
  name?: string
  required?: boolean
  readOnly?: boolean
}

export interface AnchorAttributes extends HTMLAttributes {
  href?: string
  target?: string
  rel?: string
}

export interface ImgAttributes extends HTMLAttributes {
  src?: string | (() => string)
  alt?: string
  width?: number | string
  height?: number | string
}

// ---------------------------------------------------------------------------
// Core JSX element type
// ---------------------------------------------------------------------------

export type Component<P = Record<string, unknown>> = (props: P) => JSXElement | null

export type JSXElement = {
  type: string | Component | typeof Fragment
  props: Record<string, unknown>
  key: string | null
}

// ---------------------------------------------------------------------------
// Fragment — unique symbol used as element type
// ---------------------------------------------------------------------------

export const Fragment: unique symbol = Symbol('Fragment')

// ---------------------------------------------------------------------------
// JSX factory functions
// ---------------------------------------------------------------------------

export function jsx(
  type: string | Component | typeof Fragment,
  props: Record<string, unknown>,
  key?: string,
): JSXElement {
  return {
    type,
    props: props ?? {},
    key: key !== undefined ? String(key) : null,
  }
}

export function jsxs(
  type: string | Component | typeof Fragment,
  props: Record<string, unknown>,
  key?: string,
): JSXElement {
  return jsx(type, props, key)
}

// ---------------------------------------------------------------------------
// JSX namespace — intrinsic elements and element type resolution
// ---------------------------------------------------------------------------

export declare namespace JSX {
  type Element = JSXElement

  interface IntrinsicElements {
    div: HTMLAttributes
    span: HTMLAttributes
    p: HTMLAttributes
    h1: HTMLAttributes
    h2: HTMLAttributes
    h3: HTMLAttributes
    h4: HTMLAttributes
    h5: HTMLAttributes
    h6: HTMLAttributes
    button: ButtonAttributes
    input: InputAttributes
    form: HTMLAttributes
    a: AnchorAttributes
    ul: HTMLAttributes
    li: HTMLAttributes
    ol: HTMLAttributes
    img: ImgAttributes
    section: HTMLAttributes
    article: HTMLAttributes
    header: HTMLAttributes
    footer: HTMLAttributes
    main: HTMLAttributes
    nav: HTMLAttributes
    aside: HTMLAttributes
    label: HTMLAttributes
    textarea: HTMLAttributes
    select: HTMLAttributes
    option: HTMLAttributes
    table: HTMLAttributes
    thead: HTMLAttributes
    tbody: HTMLAttributes
    tr: HTMLAttributes
    th: HTMLAttributes
    td: HTMLAttributes
    [key: string]: Record<string, unknown>
  }

  interface ElementAttributesProperty {
    props: {}
  }

  interface ElementChildrenAttribute {
    children: {}
  }
}
