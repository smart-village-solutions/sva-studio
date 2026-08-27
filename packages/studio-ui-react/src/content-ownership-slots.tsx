import * as React from 'react';

export type ContentOwnershipSlots = Readonly<{
  panel: React.ReactNode;
  saveHint: React.ReactNode;
}>;

const ContentOwnershipSlotsContext = React.createContext<ContentOwnershipSlots | null>(null);

export function ContentOwnershipSlotsProvider({
  children,
  value,
}: Readonly<{
  children: React.ReactNode;
  value: ContentOwnershipSlots;
}>) {
  return (
    <ContentOwnershipSlotsContext.Provider value={value}>
      {children}
    </ContentOwnershipSlotsContext.Provider>
  );
}

export function ContentOwnershipPanelSlot() {
  return React.useContext(ContentOwnershipSlotsContext)?.panel ?? null;
}

export function ContentOwnershipSaveHint() {
  return React.useContext(ContentOwnershipSlotsContext)?.saveHint ?? null;
}
