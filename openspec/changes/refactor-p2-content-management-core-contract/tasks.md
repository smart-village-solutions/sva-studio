## 1. Specification

- [x] 1.1 Minimalen Content-Core-Vertrag fuer Identitaet, Typ, Scope, Status, Validierung, Publikation, Historie und Audit-Metadaten spezifizieren
- [x] 1.2 Host-owned Invarianten fuer Statusuebergaenge, Persistenz, Autorisierung, Historie und Audit gegen pluginseitige Erweiterungen abgrenzen
- [x] 1.3 Stabilen IAM-Primitivvertrag fuer Content-Core-Operationen mit fully-qualified Action-IDs spezifizieren
- [x] 1.4 Payload-unabhaengigen Audit-Metadatenvertrag fuer Content-Core-Mutationen spezifizieren
- [x] 1.5 Design-Entscheidungen, Migrationsgrenzen und Abhaengigkeiten zu P2/P3-Folgechanges dokumentieren
- [x] 1.6 Kompatibilitaetsentscheidung fuer bestehende `content.write`-/`content.update`-Rechte dokumentieren: Alias, Migration oder harter Schnitt
- [x] 1.7 `openspec validate refactor-p2-content-management-core-contract --strict` ausfuehren

## 2. Current-State Baseline

- [x] 2.1 Ist-Zustand der Content-Core-Typen in `packages/core/src/content-management.ts` erfassen und Zielfeldliste dagegen mappen
- [x] 2.2 Ist-Zustand der DB-Felder in `packages/data/migrations/*content*` erfassen und fehlende Core-Felder als Migration Gap notieren
- [x] 2.3 Ist-Zustand der Content-Mutationspfade in `packages/auth/src/iam-contents/` erfassen: create, update, delete, history read
- [x] 2.4 Ist-Zustand der Plugin-Content-Registrierung in `packages/plugin-sdk` und `packages/auth/src/iam-contents/content-type-registry.ts` erfassen
- [x] 2.5 Ist-Zustand der Content-Permissions in Seeds, Tests, Plugin-Guards und UI-Mocks erfassen (`content.read`, `content.create`, `content.write`, `content.update`, `content.publish`)
- [x] 2.6 Vor Implementierung die aktuelle betroffene Testsuite ausfuehren und roten Ausgangszustand klaeren: `pnpm nx affected --target=test:unit --base=origin/main`

## 3. Core Contract Implementation

- [x] 3.1 `IamContentListItem`, `IamContentDetail`, Create-/Update-Inputs und History-Typen auf die host-owned Core-Felder ausrichten
- [x] 3.2 DB-Migration fuer fehlende Core-Metadaten entwerfen: Scope, Owner, Validation State, History-/Revision-/Audit-Referenzen, sofern nicht bewusst out of scope
- [x] 3.3 Up-/Down-Migrationen ergaenzen und bestehende Inhalte deterministisch befuellen oder als nicht migrierbar melden
- [x] 3.4 Repository-Mapping in `packages/auth/src/iam-contents/repository*.ts` auf die neuen Core-Felder erweitern
- [x] 3.5 Hostseitige Validierung fuer reservierte Core-Feldnamen und Core-Semantik ergaenzen
- [x] 3.6 Nach diesem Block ausfuehren: `pnpm check:server-runtime`
- [x] 3.7 Nach diesem Block ausfuehren: `pnpm nx run core:test:unit` und betroffene Auth-/Data-Unit-Tests

## 4. Permission Compatibility and IAM Primitives

- [x] 4.1 Neue Primitive als kanonische Konstanten modellieren: `content.read`, `content.create`, `content.updateMetadata`, `content.updatePayload`, `content.changeStatus`, `content.publish`, `content.archive`, `content.restore`, `content.readHistory`, `content.manageRevisions`, `content.delete`
- [x] 4.2 Kompatibilitaetsmapping fuer bestehende Rechte implementieren oder migrieren: mindestens `content.write` und `content.update`
- [x] 4.3 Seeds und Rollen-Permission-Zuordnungen um neue Primitive erweitern, ohne bestehende Rollen unbeabsichtigt zu entziehen
- [x] 4.4 Plugin-SDK-Guards von grobem `content.write` auf passende Core-Primitive vorbereiten oder bewusst ueber Compatibility Layer weiterfuehren
- [x] 4.5 Konfliktvalidierung ergaenzen: Plugins duerfen keine host-owned `content.*`-Primitive als eigene Plugin-Actions deklarieren oder shadowen
- [x] 4.6 Tests fuer Alias-/Migrationsverhalten, fehlende Permissions, deny-Effekte und Plugin-Action-Konflikte ergaenzen
- [x] 4.7 Nach diesem Block ausfuehren: `pnpm nx run auth:test:unit` und `pnpm nx run plugin-sdk:test:unit`

## 5. Content Operation Authorization

- [x] 5.1 `list` und `detail` auf `content.read` mit resolved `instanceId`, `contentType`, optional `contentId` und Scope pruefen
- [x] 5.2 `create` auf `content.create` pruefen, bevor Persistenz oder Idempotency-Abschluss erfolgt
- [x] 5.3 Metadata-Aenderungen wie Titel, Publikationsfenster oder Owner-Scope auf `content.updateMetadata` pruefen
- [x] 5.4 Payload-Aenderungen auf `content.updatePayload` pruefen und Plugin-Payload-Felder nicht als IAM-Actions verwenden
- [x] 5.5 Statuswechsel separat erkennen und auf `content.changeStatus`, `content.publish`, `content.archive` oder `content.restore` pruefen
- [x] 5.6 History-Lesen auf `content.readHistory` pruefen
- [x] 5.7 Delete entweder auf `content.delete` pruefen oder bewusst als Soft-/Archive-Flow abgrenzen
- [x] 5.8 Operationen ohne deterministisch aufgeloesten Scope vor Persistenz verweigern
- [x] 5.9 Tests fuer jede Operation ergaenzen: allowed, missing permission, deny permission, missing scope, instance mismatch
- [x] 5.10 Nach diesem Block ausfuehren: `pnpm nx run auth:test:unit`

## 6. Plugin Content Boundary

- [x] 6.1 Plugin-Content-Definitionen auf payload-nahe Erweiterungen begrenzen: Payload-Schema, Display-Metadaten, UI-Bindings, Zusatzvalidierung
- [x] 6.2 SDK-/Registry-Validierung fuer reservierte Core-Felder ergaenzen, z. B. Status, Scope, History, Revision, Audit-Referenzen
- [x] 6.3 Harte `content-type-registry`-Sonderfaelle im Auth-Package gegen den Build-time-Registry-Vertrag pruefen und Migrationspfad festlegen
- [x] 6.4 Legacy-Content-Type-Aliase wie `news` vs. `news.article` bewerten und dokumentiert migrieren oder als Alias absichern
- [x] 6.5 Tests fuer gueltige Payload-Schemas, ungueltige Core-Ueberschreibungen, Namespace-Mismatch und Legacy-Aliase ergaenzen
- [x] 6.6 Nach diesem Block ausfuehren: `pnpm nx run plugin-sdk:test:unit`, `pnpm nx run plugin-news:test:unit`, betroffene Auth-Tests

## 7. Audit and History Separation

- [x] 7.1 History-Vertrag festlegen: welche Snapshot-/Diff-Daten bleiben in `content_history`, und welche gehoeren nicht in Audit
- [x] 7.2 Audit-Event-Builder fuer Content-Core-Mutationen einfuehren oder zentralisieren
- [x] 7.3 Audit-Pflichtfelder durchsetzen: `event_id`, `timestamp`, `instance_id`, optional `organization_id`, `content_id`, `content_type`, `action`, `actor_subject_id`, `result`, `request_id`, `trace_id`
- [x] 7.4 Payload-Aenderungen nur als Klassifikation auditieren, z. B. `payload_updated`, ohne Plugin-Payload-Inhalte zu speichern
- [x] 7.5 Denials fuer Validation/Authorization mit Primitive Action, Scope soweit bekannt und deterministischem Reason Code auditierbar machen
- [x] 7.6 Revision-/Restore-Audit vorbereiten oder bewusst als Abhaengigkeit zu Admin-Standards markieren
- [x] 7.7 Tests ergaenzen, die sicherstellen, dass Plugin-Payload-Inhalte nicht im Audit-Record landen
- [x] 7.8 Nach diesem Block ausfuehren: `pnpm nx run auth:test:unit`

## 8. UI and E2E Compatibility

- [x] 8.1 Content-Access-Summary und UI-Hooks auf neue Primitive oder Compatibility Layer ausrichten
- [x] 8.2 Plugin-News-Actions und Routen-Guards pruefen: `create`, `edit`, `update`, `delete` muessen passende Core-Primitive verlangen
- [x] 8.3 E2E-Mocks fuer `iam/me/permissions` aktualisieren, ohne alte Tests unbegruendet zu entwerten
- [x] 8.4 Tabellen-, Editor- und History-UI auf neue Access-Zustaende pruefen
- [x] 8.5 Nach diesem Block ausfuehren: `pnpm nx run sva-studio-react:test:unit`
- [x] 8.6 Falls UI-Flows betroffen sind: `pnpm nx run sva-studio-react:test:e2e` oder gezielte Playwright-Spec fuer Content/News ausfuehren

## 9. Documentation and Architecture

- [x] 9.1 Betroffene arc42-Abschnitte aktualisieren: Solution Strategy, Building Block View, Cross-Cutting Concepts, Risks/Technical Debt
- [x] 9.2 Entwicklerdokumentation fuer Content-Core-Felder, Plugin-Grenzen und Permission-Kompatibilitaet ergaenzen
- [x] 9.3 Migrationshinweise fuer bestehende Rollen, Seeds und Content-Daten dokumentieren
- [x] 9.4 Interne Doku-Links relativ zum `docs/`-Ordner schreiben
- [x] 9.5 Nach diesem Block ausfuehren: `pnpm check:file-placement`

## 10. Final Verification

- [x] 10.1 `openspec validate refactor-p2-content-management-core-contract --strict`
- [x] 10.2 `pnpm check:server-runtime`
- [x] 10.3 `pnpm test:unit`
- [x] 10.4 `pnpm test:types`
- [x] 10.5 `pnpm test:eslint`
- [x] 10.6 `pnpm test:e2e`
- [x] 10.7 Wenn zeitlich und ressourcenseitig moeglich: `pnpm test:pr`
