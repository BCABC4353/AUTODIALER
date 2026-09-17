import type { ReactNode } from 'react';
import { EmptyState } from '@ds/index.js';

export interface Column<T> {
  id: string;
  label: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  cell: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowClass,
  onContextMenu,
  onSelect,
  selectedKey,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowClass?: (row: T) => string;
  onContextMenu?: (row: T) => void;
  onSelect?: (row: T) => void;
  selectedKey?: string | null;
  empty: { title: string; description?: string };
}) {
  return (
    <div className="custom-scrollbar @container-[size] relative min-h-0 flex-1 overflow-auto rounded-md border border-line bg-surface-base">
      <table className="w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th
                key={c.id}
                style={{ width: c.width }}
                className={`h-8 whitespace-nowrap border-b border-line bg-surface-raised px-3 text-fluid-nano font-black uppercase tracking-wider text-content-muted ${
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = selectedKey !== undefined && selectedKey === key;
            return (
              <tr
                key={key}
                aria-selected={selected || undefined}
                onClick={onSelect ? () => onSelect(row) : undefined}
                onContextMenu={(e) => {
                  if (!onContextMenu) return;
                  e.preventDefault();
                  onContextMenu(row);
                }}
                className={`ds-table-row transition-colors ${onSelect ? 'cursor-pointer' : 'cursor-default'} ${
                  selected ? 'bg-row-active' : 'hover:bg-row-hover'
                } ${rowClass ? rowClass(row) : ''}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={`whitespace-nowrap px-3 text-fluid-nano font-bold uppercase tabular-nums ${c.mono ? 'font-mono normal-case' : ''} ${
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="px-4 py-10">
          <EmptyState size="sm" title={empty.title} description={empty.description} />
        </div>
      )}
    </div>
  );
}

export function BlankDash() {
  return (
    <span className="text-fluid-nano font-normal text-content-subtle" aria-label="no value">
      –
    </span>
  );
}
