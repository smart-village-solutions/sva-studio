# Change: Generischen Vollzugriff auf alle GenericItems zulassen

## Why

Das Generic-Items-Modul ist die technische Vollansicht des Mainserver-Typs `GenericItem`. Die aktuelle Inhaltsprojektion blendet einzelne fachlich spezialisierte `genericType`-Werte aus und widerspricht damit dem generischen CRUD-Vertrag, der diese Datensätze bereits lesen und bearbeiten kann.

## What Changes

- Die generische Liste und Projektion enthalten alle GenericItems unabhängig vom `genericType`, einschließlich `FeaturedProject`, `FAQ` und `COCKPIT_CARD`.
- Generische Detail- und Mutationspfade autorisieren ausschließlich mit `generic-items.*`; zusätzliche Fachrechte sind nicht erforderlich.
- Fachplugins behalten ihre eigenen gefilterten Listen, Validierungen und Action-Namespaces.
- Personen mit generischen und fachlichen Leserechten können denselben Mainserver-Datensatz in der gemeinsamen Inhaltsübersicht in beiden autorisierten Repräsentationen sehen.
- Die Dokumentation kennzeichnet `generic-items.*` als technischen Vollzugriff, der regulären Live-Rollen nicht zugewiesen werden soll.

## Impact

- Affected specs: `content-management`, `plugin-platform`, `sva-mainserver-integration`
- Affected code: GenericItem-Projektionsfilter in `apps/sva-studio-react` und `packages/sva-mainserver`, zugehörige Tests
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `package-gesamtuebersicht`
- Keine Datenbankmigration und keine Änderung des Mainserver-Datenmodells

