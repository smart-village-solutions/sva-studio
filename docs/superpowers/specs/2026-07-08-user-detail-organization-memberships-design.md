# Design: Organisationsmitgliedschaften auf der User-Detailseite

## Kontext
Die Benutzer-Detailseite zeigt bisher persoenliche Daten, Rollen, Gruppen, Rechte und Historie. Organisationsmitgliedschaften koennen derzeit nur ueber die Organisations-Detailseite gepflegt werden. Das fuehrt zu einem unvollstaendigen Benutzerverwaltungsfluss.

## Zielbild
- Eigener Tab `Organisationen` auf `/admin/users/:userId`
- Anzeige aller bestehenden Organisationsmitgliedschaften eines Accounts
- Zuweisung weiterer Organisationen ueber eine suchbare Auswahl
- Pflege von `visibility` und `isDefaultContext` pro Membership
- Entfernen bestehender Memberships direkt im User-Kontext
- Einheitliche Fachlogik zwischen User- und Organisations-Detailseite

## Ansatz
Das bestehende Organisations-Membership-Modell bleibt fuehrend. Statt einen zweiten user-zentrierten Schreibpfad einzufuehren, wird die bestehende Organisations-Membership-API um eine Update-Mutation fuer Membership-Attribute erweitert und von beiden Oberflaechen wiederverwendet.

Das User-Detail-Read-Model wird um `organizationMemberships` erweitert. Jeder Eintrag soll die Organisationsidentitaet und die Membership-Metadaten enthalten, damit die User-Detailseite keine zusaetzlichen Join- oder Ableitungsschritte im Browser nachbauen muss.

## UI-Verhalten
- Neuer Tab `Organisationen` zwischen `Management` und `Berechtigungen`
- Bestehende Memberships als Liste oder Karten mit:
  - Organisationsname
  - `organizationKey`
  - `visibility`
  - `isDefaultContext`
  - `createdAt`
- Pro Eintrag:
  - `visibility` per Select aenderbar
  - `isDefaultContext` per Checkbox oder Toggle aenderbar
  - Entfernen per destruktiver Aktion
- Neue Zuweisung:
  - suchbare Auswahl aus aktiven, noch nicht zugewiesenen Organisationen
  - `visibility` und `isDefaultContext` waehrend der Zuweisung setzbar

## API und Datenfluss
- `GET /api/v1/iam/users/:userId` liefert zusaetzlich `organizationMemberships`
- Bestehende POST/DELETE-Mutationspfade fuer Organizations-Memberships bleiben erhalten
- Zusaetzlich wird eine PATCH-Mutation fuer eine bestehende Organisationsmitgliedschaft eingefuehrt, damit `visibility` und `isDefaultContext` ohne Remove/Re-Add angepasst werden koennen
- Die Organisations-Detailseite nutzt denselben Update-Pfad, um doppelte Fachlogik zu vermeiden

## Fehlerbehandlung
- Ungueltige oder instanzfremde Zuordnungen bleiben serverseitig abgewiesen
- Default-Kontext-Konflikte werden serverseitig fachlich aufgeloest
- Frontend zeigt bestehende IAM-Fehlermeldungen mit Retry- oder Inline-Status an

## Tests
- Backend-Tests fuer User-Detail-Read-Model mit Organisationsmitgliedschaften
- Backend-Tests fuer Membership-Update-Mutation
- Frontend-Tests fuer neuen Tab, Anzeige, Zuweisung, Update und Entfernen
- Zielgerichtete Unit- und Type-Gates nach dem jeweiligen Aenderungsblock
