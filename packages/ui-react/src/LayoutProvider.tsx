import { createContext, useContext, type ReactNode } from 'react';
import type { LayoutData } from '@southland/ui-schema';

const LayoutContext = createContext<LayoutData | null>(null);

interface LayoutProviderProps {
  layout: LayoutData;
  children: ReactNode;
}

export function LayoutProvider({ layout, children }: LayoutProviderProps) {
  return (
    <LayoutContext.Provider value={layout}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutData {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return ctx;
}

export function useHeader() {
  return useLayout().header;
}

export function useFooter() {
  return useLayout().footer;
}
