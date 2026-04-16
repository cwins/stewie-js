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
  status: TaskStatus;
}

export function StatusBadge({ status }: StatusBadgeProps): JSXElement {
  return <span class={`badge badge-status badge-status-${status}`}>{STATUS_LABELS[status]}</span>;
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
  priority: TaskPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps): JSXElement {
  return <span class={`badge badge-priority badge-priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>;
}
