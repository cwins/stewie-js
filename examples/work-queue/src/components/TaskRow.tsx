/// <reference types="vite/client" />
import type { JSXElement, Reactive } from '@stewie-js/core';
import { StatusBadge, PriorityBadge } from './lib/Badge.js';
import { UserChip } from './lib/UserChip.js';
import type { Task, UserPublic } from '../data/types.js';

interface TaskRowProps {
  // Reactive rather than a plain Task so inline field edits from the parent's
  // $tasks signal propagate into this row without remounting it. A static
  // Task prop would only reflect changes that cause For to reshuffle slots
  // (e.g. status changes that move the task between lists).
  task: Reactive<Task>;
  /** Reactive lookup from user id to public user record. */
  usersById: Reactive<Record<string, UserPublic>>;
  /** Called when the row is clicked to open the detail/edit panel. */
  onSelect: (task: Task) => void;
  isSelected: Reactive<boolean>;
}

export function TaskRow({ task, usersById, onSelect, isSelected }: TaskRowProps): JSXElement {
  return (
    <div
      class={() => `task-row${isSelected() ? ' task-row-selected' : ''}`}
      data-testid={() => `task-row-${task().id}`}
      onClick={() => onSelect(task())}
      role="button"
      tabIndex={0}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(task());
      }}
    >
      <div class="task-row-main">
        <span class={() => `task-row-title${task().status === 'done' ? ' task-row-title-done' : ''}`}>{() => task().title}</span>
        {() => (task().description ? <span class="task-row-desc">{task().description}</span> : null)}
      </div>
      <div class="task-row-meta">
        <UserChip
          variant="compact"
          user={() => {
            const id = task().assigneeId;
            return id ? (usersById()[id] ?? null) : null;
          }}
        />
        <PriorityBadge priority={() => task().priority} />
        <StatusBadge status={() => task().status} />
        {() => (task().dueDate ? <span class="task-row-due">{task().dueDate}</span> : null)}
      </div>
    </div>
  );
}
