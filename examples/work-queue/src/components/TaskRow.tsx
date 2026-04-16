/// <reference types="vite/client" />
import type { JSXElement } from '@stewie-js/core';
import { StatusBadge, PriorityBadge } from './lib/Badge.js';
import type { Task } from '../data/types.js';

interface TaskRowProps {
  task: Task;
  /** Called when the row is clicked to open the detail/edit panel. */
  onSelect: (task: Task) => void;
  isSelected: () => boolean;
}

export function TaskRow({ task, onSelect, isSelected }: TaskRowProps): JSXElement {
  return (
    <div
      class={() => `task-row${isSelected() ? ' task-row-selected' : ''}`}
      data-testid={`task-row-${task.id}`}
      onClick={() => onSelect(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(task);
      }}
    >
      <div class="task-row-main">
        <span class={`task-row-title${task.status === 'done' ? ' task-row-title-done' : ''}`}>{task.title}</span>
        {task.description ? <span class="task-row-desc">{task.description}</span> : null}
      </div>
      <div class="task-row-meta">
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />
        {task.dueDate ? <span class="task-row-due">{task.dueDate}</span> : null}
      </div>
    </div>
  );
}
