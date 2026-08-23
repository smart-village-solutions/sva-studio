# Change: Globale Sortierung für paginierte Tabellen erzwingen

## Why

Mehrere Studio-Tabellen sortieren derzeit nur die bereits geladene Seite, obwohl Filter und Pagination auf einem größeren Datenbestand arbeiten. Dadurch hängen Reihenfolge und auffindbare Datensätze von der aktuellen Seite ab; identische Filter können beim Blättern widersprüchliche Ergebnisse liefern.

## What Changes

- Für paginierte Tabellen gilt verbindlich die Reihenfolge `Berechtigungsumfang → Filterung → deterministische Sortierung → Pagination`.
- `StudioDataTable` unterscheidet explizit zwischen deaktivierter, clientseitiger Vollbestands- und externer Sortierung.
- Extern sortierte Tabellen zeigen auf Desktop und Mobilgeräten genau einen kontrollierten Sortierzustand an, wechseln ausschließlich zwischen auf- und absteigender Richtung und verändern eine bereits paginierte Ergebnismenge nicht nochmals im Browser.
- Inhaltsliste, Organisationsliste, Governance-Fälle, DSR-Fälle und Waste-Fraktionen werden auf den gemeinsamen Vertrag umgestellt.
- Die Inhaltsliste unterstützt `createdAt` und `publishedAt` vollständig serverseitig; technisch oder sprachlich nicht deckungsgleich sortierbare Typ- und Statusspalten verlieren ihre Sortieraktion.
- Die Organisationsliste sortiert standardmäßig nach Anzeigename, entfernt die irreführende Hierarchieeinrückung und bietet keine sprachabhängig inkorrekte Typ-Sortierung mehr an.
- Governance und DSR erhalten eine nutzbare Pagination mit Gesamtzahl und den Seitengrößen 25, 50 und 100.
- Sortier-, Filter- und Seitengrößenwechsel setzen die Pagination auf die erste Seite zurück; fehlende Werte stehen immer zuletzt und ein fester Tie-Breaker `ID asc` verhindert eine zufällige Seitenzuordnung.
- Die paginierten Tenant- und Plattform-Benutzerlisten bieten vorerst keine Sortieraktionen mehr an, weil die führende Keycloak-Liste die dargestellten Sortierfelder nicht global unterstützt und ein vollständiger Provider-Scan pro Sortierung nicht Teil dieses Changes ist.
- Ungültige UI-Sortierwerte werden vor dem Request auf den sichtbaren Default normalisiert; direkte API-Requests mit nicht erlaubten Feldern oder Richtungen werden mit `400 invalid_request` abgewiesen.
- Komponenten-, Repository-, Handler- und UI-Tests belegen die Reihenfolge über mehrere Seiten und verhindern eine erneute lokale Seitensortierung.

## Non-Goals

- Keine vollständige lokale Materialisierung aller Keycloak-Benutzer.
- Kein browserseitiger Vollscan serverseitig paginierter Listen.
- Keine neue allgemeine Tabellen-, Query- oder Repository-Abstraktion außerhalb des nachgewiesenen Sortiervertrags.
- Keine Sortierfunktion für Tabellen, die bisher keine Sortierung anbieten.
- Keine sprachabhängige Sortierkopplung zwischen UI und Backend.
- Keine Änderung fachlicher Filter-, Berechtigungs- oder Sichtbarkeitssemantik.

## Impact

- Affected specs: `ui-layout-shell`, `account-ui`, `iam-organizations`, `iam-access-control`, `iam-data-subject-rights`, `content-management`, `waste-management`
- Affected code: `packages/studio-ui-react`, `apps/sva-studio-react` sowie die betroffenen IAM-Read-Models und Runtime-Handler in `packages/iam-admin`, `packages/iam-governance` und `packages/auth-runtime`; Waste-Fraktionen in `packages/plugin-waste-management`
- Related active changes: `use-mainserver-data-provider-as-content-author`, `add-organization-mainserver-provisioning`, `centralize-scoped-ui-access`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `11-risks-and-technical-debt`
- Required tests: gemeinsame Desktop-/Mobil-Komponententests, fachliche Sortier-/Paginationstests über mehrere Seiten, strikte API-Query- und Handler-Tests sowie gezielte UI-Interaktionstests
