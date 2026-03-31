// hydration-cursor.ts — stateful walker over server-rendered DOM nodes.
//
// The SSR renderer emits comment markers after each dynamic region:
//   <!---->   function children anchor
//   <!--Show-->  Show / Match anchor
//   <!--For-->   For anchor
//   <!--Switch--> Switch anchor
//
// During hydration, the cursor walks the existing childNodes in document
// order, claiming live nodes for the client renderer to attach effects to
// instead of creating fresh ones.

export class HydrationCursor {
  /** Index into _nodes — how many nodes have been consumed so far. */
  idx = 0;
  private _nodes: ChildNode[];

  constructor(nodes: ArrayLike<ChildNode>) {
    this._nodes = Array.from(nodes);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /** Skip past whitespace-only text nodes (browser inserts them around elements). */
  private _skipWs(): void {
    while (this.idx < this._nodes.length) {
      const n = this._nodes[this.idx];
      if (n.nodeType === 3 /* TEXT_NODE */ && (n as Text).data.trim() === '') {
        this.idx++;
      } else {
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Claim the next element node if its tag name matches `tag`.
   * Advances the cursor. Returns `null` on a tag mismatch (hydration fallback).
   */
  claimElement(tag: string): Element | null {
    this._skipWs();
    const n = this._nodes[this.idx];
    if (n && n.nodeType === 1 /* ELEMENT_NODE */ && (n as Element).tagName.toLowerCase() === tag.toLowerCase()) {
      this.idx++;
      return n as Element;
    }
    return null;
  }

  /**
   * Claim the next text node (no whitespace skip — text content is significant).
   * Returns `null` if the next node is not a text node.
   */
  claimText(): Text | null {
    const n = this._nodes[this.idx];
    if (n && n.nodeType === 3 /* TEXT_NODE */) {
      this.idx++;
      return n as Text;
    }
    return null;
  }

  /**
   * Scan forward to the first comment whose data equals `marker`.
   * Returns all nodes before the comment as `contentNodes` and the comment
   * itself as `anchor`, advancing the cursor past both.
   *
   * Returns `null` if the marker comment is not found — the caller should
   * fall back to a fresh client render for this region.
   */
  collectUntilComment(marker: string): { contentNodes: ChildNode[]; anchor: Comment } | null {
    const contentNodes: ChildNode[] = [];
    for (let i = this.idx; i < this._nodes.length; i++) {
      const n = this._nodes[i];
      if (n.nodeType === 8 /* COMMENT_NODE */ && (n as Comment).data === marker) {
        this.idx = i + 1;
        return { contentNodes, anchor: n as Comment };
      }
      contentNodes.push(n);
    }
    return null;
  }

  /**
   * Create a child cursor over `el.childNodes` for descending into a claimed
   * element's children.
   */
  childCursor(el: Element): HydrationCursor {
    return new HydrationCursor(el.childNodes);
  }
}
