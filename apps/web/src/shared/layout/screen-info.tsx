import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface ScreenInfoItem {
  label: string;
  value: string;
}

interface ScreenInfoValue {
  items: readonly ScreenInfoItem[];
  set_items: (items: readonly ScreenInfoItem[]) => void;
}

const ScreenInfoContext = createContext<ScreenInfoValue>({
  items: [],
  set_items: () => undefined,
});

/** A página informa o que a topbar mostra (por exemplo, o total de itens da listagem). */
export function ScreenInfoProvider({ children }: { children: ReactNode }) {
  const [items, set_items] = useState<readonly ScreenInfoItem[]>([]);
  const value = useMemo(() => ({ items, set_items }), [items]);
  return <ScreenInfoContext.Provider value={value}>{children}</ScreenInfoContext.Provider>;
}

export function useScreenInfo(): ScreenInfoValue {
  return useContext(ScreenInfoContext);
}
