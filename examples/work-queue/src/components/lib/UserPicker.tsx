/// <reference types="vite/client" />
// UserPicker — single-user select with an "Unassigned" sentinel.
//
// One shared component for task assignee and project lead. The picker owns
// the select markup and the null<->'' coercion; the caller owns the signal
// and the validation. value is an accessor so the picker reflects writes
// from peers (e.g. an action result that updates the signal).

import type { JSXElement } from '@stewie-js/core';
import type { UserPublic } from '../../data/types.js';

interface UserPickerProps {
  users: UserPublic[];
  value: () => string | null;
  onChange: (id: string | null) => void;
  /** Visible label. When omitted, the picker renders without a <label>. */
  label?: string;
  /** id used to associate the label with the select. */
  inputId?: string;
  /** Sentinel option text. Defaults to "Unassigned". */
  emptyLabel?: string;
  testId?: string;
}

export function UserPicker({ users, value, onChange, label, inputId, emptyLabel = 'Unassigned', testId }: UserPickerProps): JSXElement {
  const select = (
    <select
      id={inputId}
      class="field-select"
      value={value() ?? ''}
      onChange={(e: Event) => {
        const v = (e.target as HTMLSelectElement).value;
        onChange(v === '' ? null : v);
      }}
      data-testid={testId}
    >
      <option value="">{emptyLabel}</option>
      {() => users.map((u) => <option value={u.id}>{u.displayName}</option>)}
    </select>
  );

  if (label === undefined) return select;
  return (
    <div class="field-group">
      <label class="field-label" for={inputId}>
        {label}
      </label>
      {select}
    </div>
  );
}
