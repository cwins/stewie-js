import type { JSXElement } from '@stewie-js/core';
import { Button } from './lib/button.js';
import { Input } from './lib/input.js';
import { Select } from './lib/select.js';

export function FilterBar({
  searchValue,
  searchPlaceholder,
  onSearchInput,
  selectValue,
  selectOptions,
  onSelectChange,
  onApply,
  onClear
}: {
  searchValue: string;
  searchPlaceholder: string;
  onSearchInput: (e: Event) => void;
  selectValue: string;
  selectOptions: Array<{ label: string; value: string }>;
  onSelectChange: (e: Event) => void;
  onApply: (e: Event) => void;
  onClear: () => void;
}): JSXElement {
  return (
    <form class="filter-bar" onSubmit={onApply}>
      <Input
        value={searchValue}
        placeholder={searchPlaceholder}
        onInput={onSearchInput}
        aria-label={searchPlaceholder}
      />
      <Select value={selectValue} onChange={onSelectChange} options={selectOptions} />
      <Button type="submit">Apply</Button>
      <Button type="button" variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </form>
  );
}
