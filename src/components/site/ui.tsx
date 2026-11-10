import React, { useEffect, useMemo, useRef } from 'react';
import { Upload } from 'lucide-react';
import { batchWrite, CollectionName } from '../../services/studioStore';
import { UploadedImage } from '../../types';

export const inputClass =
  'w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/40';
export const labelClass = 'block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1';
export const cardClass = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900';
export const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-sm font-semibold cursor-pointer disabled:opacity-50';
export const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50';
export const iconBtn =
  'p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-30 disabled:cursor-default';
export const chip = (active: boolean) =>
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border ${
    active
      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100'
      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
  }`;

export const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={`${cardClass} p-8 text-center text-sm text-zinc-500`}>{children}</div>
);

export const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1.5">
    <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</dt>
    <dd className="font-medium">{value}</dd>
  </div>
);

export const PhotoPicker: React.FC<{
  current?: UploadedImage;
  file: File | null;
  onFile: (f: File | null) => void;
  label?: string;
  aspect?: string;
}> = ({ current, file, onFile, label = 'Foto *', aspect = 'aspect-[4/5]' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : current?.url), [file, current]);
  useEffect(
    () => () => {
      if (file && preview) URL.revokeObjectURL(preview);
    },
    [file, preview]
  );

  return (
    <div>
      <span className={labelClass}>{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`relative w-full ${aspect} max-h-72 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 overflow-hidden flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 cursor-pointer`}
      >
        {preview ? (
          <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-zinc-500">
            <Upload className="w-5 h-5" /> Escolher foto
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
};

/** Swaps an item with its neighbour, renumbering the whole list 0..n-1. */
export const moveItem = async (
  name: Extract<CollectionName, 'portfolio' | 'shop'>,
  items: { id: string }[],
  index: number,
  delta: -1 | 1
) => {
  const target = index + delta;
  if (target < 0 || target >= items.length) return;
  const ordered = items.map((item, i) => ({ id: item.id, order: i }));
  [ordered[index].order, ordered[target].order] = [ordered[target].order, ordered[index].order];
  await batchWrite(ordered.map((o) => ({ type: 'update' as const, name, id: o.id, data: { order: o.order } })));
};

export const nextOrder = (items: { order: number }[]) =>
  items.reduce((max, i) => Math.max(max, i.order ?? 0), -1) + 1;

export const eur = (n: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(n || 0);
