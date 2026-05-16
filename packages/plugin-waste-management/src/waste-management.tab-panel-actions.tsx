import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

const WasteTabPanelActionsContext = createContext<((actions: ReactNode | null) => void) | null>(null);

export const WasteTabPanelActionsProvider = ({
  children,
  render,
}: {
  readonly children: ReactNode;
  readonly render: (actions: ReactNode | null) => ReactNode;
}) => {
  const [actions, setActions] = useState<ReactNode | null>(null);

  return (
    <WasteTabPanelActionsContext.Provider value={setActions}>
      {render(actions)}
      {children}
    </WasteTabPanelActionsContext.Provider>
  );
};

export const useWasteTabPanelActions = (actions: ReactNode | null) => {
  const setActions = useContext(WasteTabPanelActionsContext);

  useLayoutEffect(() => {
    if (!setActions) {
      return;
    }

    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);
};
