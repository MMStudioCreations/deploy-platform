import { create } from 'zustand';

interface FilterState {
  searchQuery: string;
  categoryFilter: string;
  setSearchQuery: (q: string) => void;
  setCategoryFilter: (cat: string) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  searchQuery: '',
  categoryFilter: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
}));
