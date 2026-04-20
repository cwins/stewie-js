/// <reference types="vite/client" />
import type { JSXElement } from '@stewie-js/core';
import type { TaskStatus, TaskPriority } from '../../data/types.js';

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done'
};

interface StatusBadgeProps {
  // Accepts a plain value or an accessor so parents can pass reactive task
  // fields (e.g. `() => task().status`) without the badge going stale on
  // inline edits.
  status: TaskStatus | (() => TaskStatus);
}

function resolve<T>(v: T | (() => T)): () => T {
  return typeof v === 'function' ? (v as () => T) : () => v;
}

export function StatusBadge({ status }: StatusBadgeProps): JSXElement {
  const get = resolve(status);
  return <span class={() => `badge badge-status badge-status-${get()}`}>{() => STATUS_LABELS[get()]}</span>;
}

// ---------------------------------------------------------------------------
// PriorityBadge
// ---------------------------------------------------------------------------

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

interface PriorityBadgeProps {
  priority: TaskPriority | (() => TaskPriority);
}

export function PriorityBadge({ priority }: PriorityBadgeProps): JSXElement {
  const get = resolve(priority);
  return <span class={() => `badge badge-priority badge-priority-${get()}`}>{() => PRIORITY_LABELS[get()]}</span>;
}
