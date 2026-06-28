## 1. Autorisierungsmodell

- [x] 1.1 Ownership-Transfer-Regeln in Core/Auth-Runtime so anpassen, dass nur die Update-Berechtigung am aktuellen Inhalt autorisiert und der Ziel-Owner ausschließlich validiert wird.
- [x] 1.2 Regressionstests für Transfers von `own` zu anderem User, `organization` zu anderer Organisation und ownerlosen Inhalt ergänzen.
- [x] 1.3 Effektive Permission-Read-Models auf weitesten Scope pro fachlichem Permission-Key normalisieren und Provenienz weiterhin erklärbar ausgeben.
- [x] 1.4 Tests für Scope-Reihenfolge `own < organization < all` und Rollen-/Gruppen-Provenienz ergänzen.

## 2. Sichtbare Autorenanzeige

- [x] 2.1 Inhaltsmodell, API-Schemas und UI-Vertrag um einen fachlichen Autorenanzeige-Modus ergänzen.
- [x] 2.2 `content_author_policy` serverseitig erzwingen: `org_only` erzwingt Organisationsanzeige, `org_or_personal` erlaubt zulässige Auswahl.
- [x] 2.3 Bestehende `authorDisplayName`-Behandlung auf den neuen Vertrag migrieren oder als validierten Snapshot einordnen.
- [x] 2.4 Unit- und Integrationstests für Defaulting, Policy-Erzwingung und Updates der Autorenanzeige ergänzen.

## 3. System-Admin-Ausnahmen

- [x] 3.1 Legacy-Group-, Reconcile- und Hierarchiepfade auf verbliebene rollenbasierte Bypasses prüfen.
- [x] 3.2 Normale Tenant-Admin-Flows auf explizite Permissions umstellen.
- [x] 3.3 Verbleibende Bootstrap- oder Plattform-Ausnahmen technisch begrenzen, dokumentieren und auditieren.
- [x] 3.4 Tests für System-Admin ohne passende Permission und für erlaubte Ausnahmefälle ergänzen.

## 4. Mainserver-Projektion

- [x] 4.1 Projection-Mapping so ändern, dass externe Mainserver-Organisationswerte nicht automatisch `ownerOrganizationId` setzen.
- [x] 4.2 Quellkontext und kanonische IAM-Ownership im Projection-Modell trennen.
- [x] 4.3 Mainserver-`dataProvider` als externe Veröffentlichungsidentität mit `sourceDataProvider*` und `credentialSource` modellieren.
- [x] 4.4 Explizite Mapping-Regeln von Mainserver-DataProvider zu Studio-Organisation, Studio-User oder ownerlosem Status definieren.
- [x] 4.5 Mutationskontext für Organisations- vs. persönliche Mainserver-Schreibvorgänge explizit modellieren und validieren.
- [x] 4.6 Tests für Benutzer mit mehreren Organisationen ergänzen: Organisationsanlage, persönlicher Fallback und falscher/fehlender aktiver Organisationskontext.
- [x] 4.7 Sichtbarkeits-SQL und Refresh-/Delete-Pfade für ownerlose externe Inhalte fail-closed testen.
- [x] 4.8 Rebuild- oder Migrationspfad für bestehende Projection-Daten definieren.

## 5. Audit und Dokumentation

- [x] 5.1 Audit-Events für Ownership-Transfer, Autorenanzeige-Modus und System-Admin-Ausnahmen ergänzen.
- [x] 5.2 `docs/guides/iam-autorisierungsmodell-zielbild.md` und relevante Content-/Mainserver-Guides aktualisieren.
- [x] 5.3 Relevante arc42-Abschnitte unter `docs/architecture/` aktualisieren.
- [x] 5.4 Bei Schemaänderungen `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` fortschreiben.

## 6. Verifikation

- [x] 6.1 Betroffene Unit-Tests über Nx ausführen.
- [x] 6.2 Bei Server-Runtime-relevanten Änderungen `pnpm check:server-runtime` ausführen.
- [x] 6.3 Betroffene Type-Tests ausführen.
- [x] 6.4 Vor PR-Erstellung nach Möglichkeit `pnpm test:pr` ausführen oder Abweichung dokumentieren.
  Abweichung: `pnpm test:pr` wurde nicht ausgeführt; stattdessen liefen die relevanten Unit-, Type-, Server-Runtime-, Data-, File-Placement- und OpenSpec-Gates erfolgreich.
