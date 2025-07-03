import React, { useState } from 'react';
import { Button } from './button';
import { Download } from 'lucide-react';

interface ConfirmedField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date';
  description: string;
  required: boolean;
}

interface HeaderTableProps {
  data: Record<string, string | number | null>;
  fields: ConfirmedField[];
  onDataChange: (updated: Record<string, string | number | null>) => void;
}

function HeaderTable({ data, fields, onDataChange }: HeaderTableProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [temp, setTemp] = useState('');

  const startEdit = (name: string) => {
    setEditing(name);
    setTemp(String(data[name] ?? ''));
  };

  const finishEdit = (field: ConfirmedField) => {
    let newVal: string | number | null = temp;
    if (field.type === 'number') {
      const parsed = parseFloat(temp);
      if (!isNaN(parsed)) newVal = parsed;
    }
    onDataChange({ ...data, [field.name]: newVal });
    setEditing(null);
  };

  const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

  return (
    <div className="border rounded-lg overflow-x-auto text-xs">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left font-medium">Field</th>
            <th className="p-2 text-left font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-t">
              <td className="p-2 whitespace-nowrap text-gray-800 border-r last:border-r-0">{f.label}</td>
              <td className="p-2">
                {editing === f.name ? (
                  <input
                    className="w-full text-xs bg-transparent outline-none border-none"
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    onBlur={() => finishEdit(f)}
                    autoFocus
                  />
                ) : (
                  <span className="cursor-text" onClick={() => startEdit(f.name)}>
                    {fmt(data[f.name])}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface LineItemsTableProps {
  items: Record<string, string | number | null>[];
  fields: ConfirmedField[];
  onItemsChange: (updated: Record<string, string | number | null>[]) => void;
}

function LineItemsTable({ items, fields, onItemsChange }: LineItemsTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [temp, setTemp] = useState('');

  const startEdit = (row: number, field: string) => {
    setEditingCell({ row, field });
    setTemp(String(items[row][field] ?? ''));
  };

  const finishEdit = (row: number, fieldMeta: ConfirmedField) => {
    let newVal: string | number | null = temp;
    if (fieldMeta.type === 'number') {
      const p = parseFloat(temp);
      if (!isNaN(p)) newVal = p;
    }
    const newItems = [...items];
    newItems[row] = { ...newItems[row], [fieldMeta.name]: newVal };
    onItemsChange(newItems);
    setEditingCell(null);
  };

  const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

  return (
    <div className="border rounded-lg overflow-x-auto text-xs">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {fields.map((f) => (
              <th key={f.name} className="p-2 text-left font-medium whitespace-nowrap border-r last:border-r-0">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row, idx) => (
            <tr key={idx} className="border-t">
              {fields.map((f) => (
                <td key={f.name} className="p-2 whitespace-nowrap border-r last:border-r-0">
                  {editingCell && editingCell.row === idx && editingCell.field === f.name ? (
                    <input
                      className="w-full text-xs bg-transparent outline-none border-none focus-visible:ring-0 focus-visible:m-0 focus-visible:p-0"
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={temp}
                      onChange={(e) => setTemp(e.target.value)}
                      onBlur={() => finishEdit(idx, f)}
                      autoFocus
                    />
                  ) : (
                    <span className="cursor-text" onClick={() => startEdit(idx, f.name)}>
                      {fmt(row[f.name])}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DataTableProps {
  headerData?: Record<string, string | number | null>;
  lineItemsData?: Record<string, string | number | null>[];
  headerFields?: ConfirmedField[];
  lineItemFields?: ConfirmedField[];
  onChange: (updated: { header: Record<string, string | number | null>; lineItems: Record<string, string | number | null>[] }) => void;
  onExportCSV: () => void;
}

export function DataTable({ headerData, lineItemsData, headerFields = [], lineItemFields = [], onChange, onExportCSV }: DataTableProps) {
  return (
    <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Extracted Data</h3>
        <Button onClick={onExportCSV} className="flex items-center gap-1 py-1 h-7 text-xs">
          <Download className="w-3 h-3" />
          Export CSV
        </Button>
      </div>

      {headerData && headerFields.length > 0 && (
        <HeaderTable
          data={headerData}
          fields={headerFields}
          onDataChange={(updated) => onChange({ header: updated, lineItems: lineItemsData || [] })}
        />
      )}

      {lineItemsData && lineItemFields.length > 0 && (
        <LineItemsTable
          items={lineItemsData}
          fields={lineItemFields}
          onItemsChange={(updated) => onChange({ header: headerData || {}, lineItems: updated })}
        />
      )}
    </div>
  );
} 