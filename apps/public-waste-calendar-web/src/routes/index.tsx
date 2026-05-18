import { PublicWasteRootDocument } from './__root.js';
import { PublicWasteApp } from '../components/public-waste-app.js';

export function PublicWasteIndexPage() {
  return (
    <PublicWasteRootDocument>
      <main className="panel">
        <PublicWasteApp
          selectionState="incomplete"
          nextStepLabel="Ort"
          selectionOptions={[
            { id: 'c-1', label: 'Musterstadt' },
            { id: 'c-2', label: 'Nebenort' },
          ]}
          onSelectOption={() => undefined}
        />
      </main>
    </PublicWasteRootDocument>
  );
}
