/// <reference types="vite/client" />
import { signal, batch, createRoot } from '@stewie-js/core';
import type { Signal } from '@stewie-js/core';
import { mount, For } from '@stewie-js/core';

// ---------------------------------------------------------------------------
// Data model — each row carries its own label signal for fine-grained updates.
// When update() changes every 10th label, only those DOM text nodes re-run —
// the rest of the table is untouched.
// ---------------------------------------------------------------------------

interface Row {
  id: number;
  label: Signal<string>;
}

const adjectives = [
  'pretty',
  'large',
  'big',
  'small',
  'tall',
  'short',
  'long',
  'handsome',
  'plain',
  'quaint',
  'clean',
  'elegant',
  'easy',
  'angry',
  'crazy',
  'helpful',
  'mushy',
  'odd',
  'unsightly',
  'adorable',
  'important',
  'inexpensive',
  'cheap',
  'expensive',
  'fancy'
];
const colours = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'brown', 'white', 'black', 'orange'];
const nouns = [
  'table',
  'chair',
  'house',
  'bbq',
  'desk',
  'car',
  'pony',
  'cookie',
  'sandwich',
  'burger',
  'pizza',
  'mouse',
  'keyboard'
];

function rnd(arr: readonly string[]): string {
  return arr[Math.round(Math.random() * 1000) % arr.length];
}

let nextId = 1;

// Build `count` rows. Each call is wrapped in createRoot() at the call site
// so that signal() creation is allowed (Stewie's creation guard only warns
// when signals are created at module scope without a reactive root).
function buildData(count: number): Row[] {
  const rows: Row[] = Array.from({ length: count });
  for (let i = 0; i < count; i++) {
    rows[i] = {
      id: nextId++,
      label: signal(`${rnd(adjectives)} ${rnd(colours)} ${rnd(nouns)}`)
    };
  }
  return rows;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

createRoot(() => {
  const rows = signal<Row[]>([]);
  const selected = signal<number>(0);

  // Wrap data-building operations in createRoot so signal() is allowed.
  // (Signals are data — not effects — so the root disposes nothing on them.)
  function run(): void {
    let data!: Row[];
    createRoot(() => {
      data = buildData(1_000);
    });
    rows.set(data);
  }

  function runLots(): void {
    let data!: Row[];
    createRoot(() => {
      data = buildData(10_000);
    });
    rows.set(data);
  }

  function add(): void {
    let extra!: Row[];
    createRoot(() => {
      extra = buildData(1_000);
    });
    rows.set([...rows(), ...extra]);
  }

  function update(): void {
    // Fine-grained update: only the 100 affected label signals fire,
    // touching only those DOM text nodes. No row re-renders.
    batch(() => {
      const current = rows();
      for (let i = 0; i < current.length; i += 10) {
        current[i].label.update((l) => l + ' !!!');
      }
    });
  }

  function clear(): void {
    rows.set([]);
    selected.set(0);
  }

  function swapRows(): void {
    const r = rows();
    if (r.length > 998) {
      const copy = r.slice();
      const tmp = copy[1];
      copy[1] = copy[998];
      copy[998] = tmp;
      rows.set(copy);
    }
  }

  function select(id: number): void {
    selected.set(id);
  }

  function remove(id: number): void {
    rows.set(rows().filter((r) => r.id !== id));
  }

  mount(
    <div class="container">
      <div class="jumbotron">
        <div class="row">
          <div class="col-md-6">
            <h1>Stewie</h1>
          </div>
          <div class="col-md-6">
            <div class="row">
              <div class="col-sm-6 smallpad">
                <button id="run" class="btn btn-primary btn-block" type="button" onClick={run}>
                  Create 1,000 rows
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button id="runlots" class="btn btn-primary btn-block" type="button" onClick={runLots}>
                  Create 10,000 rows
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button id="add" class="btn btn-primary btn-block" type="button" onClick={add}>
                  Append 1,000 rows
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button id="update" class="btn btn-primary btn-block" type="button" onClick={update}>
                  Update every 10th row
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button id="clear" class="btn btn-primary btn-block" type="button" onClick={clear}>
                  Clear
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button id="swaprows" class="btn btn-primary btn-block" type="button" onClick={swapRows}>
                  Swap Rows
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <table class="table table-hover table-striped test-data">
        <tbody id="tbody">
          <For each={rows} key={(row: Row) => row.id}>
            {(row: Row) => (
              <tr id={String(row.id)} class={() => (selected() === row.id ? 'danger' : '')}>
                <td class="col-md-1">{row.id}</td>
                <td class="col-md-4">
                  <a class="lbl" onClick={() => select(row.id)}>
                    {row.label}
                  </a>
                </td>
                <td class="col-md-1">
                  <a class="remove" onClick={() => remove(row.id)}>
                    <span class="remove glyphicon glyphicon-remove" aria-hidden="true" />
                  </a>
                </td>
                <td class="col-md-6" />
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true" />
    </div>,
    document.getElementById('main')!
  );
});
