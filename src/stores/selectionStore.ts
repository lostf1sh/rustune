import { create } from "zustand";

interface SelectionStore {
  selectedIds: Set<number>;
  lastSelectedIndex: number | null;

  select: (id: number, index: number) => void;
  toggleSelect: (id: number, index: number) => void;
  rangeSelect: (toIndex: number, allTrackIds: number[]) => void;
  selectAll: (ids: number[]) => void;
  clearSelection: () => void;
  isSelected: (id: number) => boolean;
  selectedCount: () => number;
  getSelectedIds: () => number[];
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selectedIds: new Set(),
  lastSelectedIndex: null,

  select: (id, index) => {
    set({ selectedIds: new Set([id]), lastSelectedIndex: index });
  },

  toggleSelect: (id, index) => {
    const next = new Set(get().selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedIds: next, lastSelectedIndex: index });
  },

  rangeSelect: (toIndex, allTrackIds) => {
    const from = get().lastSelectedIndex ?? 0;
    const [start, end] = from < toIndex ? [from, toIndex] : [toIndex, from];
    const range = allTrackIds.slice(start, end + 1);
    const next = new Set(get().selectedIds);
    range.forEach((id) => next.add(id));
    set({ selectedIds: next, lastSelectedIndex: toIndex });
  },

  selectAll: (ids) => {
    set({ selectedIds: new Set(ids), lastSelectedIndex: null });
  },

  clearSelection: () => {
    set({ selectedIds: new Set(), lastSelectedIndex: null });
  },

  isSelected: (id) => get().selectedIds.has(id),
  selectedCount: () => get().selectedIds.size,
  getSelectedIds: () => Array.from(get().selectedIds),
}));
