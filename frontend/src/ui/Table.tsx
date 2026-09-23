import type { ReactNode } from 'react';

/** Generic table used by the admin/seller dashboards. */

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  empty = 'Nothing here yet.'
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <p className="font-body-md text-body-md text-on-surface-variant py-space-lg text-center">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant/50">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`font-label-md text-label-md text-on-surface-variant py-space-sm pr-space-md uppercase tracking-wider ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-outline-variant/30 hover:bg-surface-container-low/60">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`font-body-sm text-body-sm text-on-surface py-space-sm pr-space-md ${column.className ?? ''}`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
