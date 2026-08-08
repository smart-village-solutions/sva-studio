## 0. Abhängigkeiten und reale Mainserver-Verträge

- [x] 0.1 Die Changes `make-mainserver-content-authoritative`, `update-mainserver-editor-resilience` und `standardize-plugin-content-history` mit dem DataProvider-, Credential- und History-Vertrag komponieren.
- [x] 0.2 Pro Content-Typ und fachlicher Aktion eine verbindliche Matrix aus Action-ID, Mainserver-Operation, Pre-Read, DataProvider-Response, Lifecycle, Cross-Principal-Verhalten, Idempotenz und Reconciliation dokumentieren.
- [ ] 0.3 Reale Contract-Tests für persönliche und organisatorische Credentials, Create-Zuordnung, Same-Credential-Read, Cross-Principal-Update, Visibility/Status und Hard Delete ausführen.
- [x] 0.4 Nicht bestätigte Typ-/Aktionskombinationen capability-gaten; insbesondere Survey-Provider-Immutabilität nicht ohne Upstream-Nachweis voraussetzen.
- [x] 0.5 `/data_provider.json` mit demselben Bearer Token wie GraphQL integrieren, fehlende ID als erwarteten Vertragszustand behandeln und PII-haltige Rohdaten ausschließen.

## 1. Automatische DataProvider-Bindungen

- [x] 1.1 Instanzgebundene, credential-versionierte Principal-Bindungen mit `pending`, `verified`, `conflict`, `historical` und `revoked` modellieren.
- [x] 1.2 Bindungen ausschließlich aus erfolgreichem Create plus DataProvider aus Response oder Same-Credential-Re-Read erzeugen; Listen, Details, Updates, Deletes, Namen und administrative Eingaben als Beweis ausschließen.
- [x] 1.3 Gleiche Create-Beobachtungen idempotent bestätigen; abweichende Provider-IDs und konkurrierende Principal-Claims als Konflikt persistieren, ohne bestehende Bindungen zu überschreiben.
- [x] 1.4 Credential-Rotation über Fingerprint beziehungsweise Version isolieren und historische Bindungen für bestehende Inhalte erhalten.
- [x] 1.5 Zukünftige stabile Identity-IDs als zusätzliche automatische Evidenz implementieren; Gleichheit bestätigt, Abweichung erzeugt Konflikt.
- [x] 1.6 Datenbankmigration, `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` gemeinsam aktualisieren.
- [x] 1.7 Mapping-, Konflikt-, Rotation-, Shared-Provider-, Isolation- und Idempotenztests ergänzen.

## 2. Mutationsprincipal und stabiler Credential-Kontext

- [x] 2.1 Gemeinsamen versionierten Transportvertrag `actingPrincipalType: 'organization' | 'user'` für alle Studio-initiierten Schreibaktionen definieren.
- [x] 2.2 Einen unveränderlichen `MutationPrincipalContext` mit Instanz, Actor, aktiver Organisation, Principal-Typ, Credential-Quelle und Credential-Fingerprint einführen.
- [x] 2.3 Explizite persönliche oder organisatorische Credential-Auflösung ohne stillen Fallback implementieren.
- [x] 2.4 Pre-Read, Read-Merge-Write, Provider-Write, Visibility-/Status-Zweitschritt, Post-Read, Projection-Refresh, Audit und Reconciliation an denselben Kontext binden.
- [x] 2.5 Credential-/Token-Caches nach Principal-Kontext beziehungsweise Credential-Signatur trennen und bei Policy-, Mapping-, Organisations- oder Credential-Wechsel invalidieren.
- [x] 2.6 Einen nicht autorisierenden Kontext-Bindungswert für Editor-Requests ergänzen und stale Organisationswechsel vor dem Write ablehnen.
- [x] 2.7 Policy-, Credential-, Cache-, Context-Switch- und Legacy-Client-Tests ergänzen.
- [x] 2.8 Kontextbindung für V2-Updates und -Deletes verpflichtend machen und bei fehlender Client-Bindung einen fail-closed Detail-Pre-Read ausführen.

## 3. Credential-visible Compatibility und exakte Scopes

- [x] 3.1 `credential_visible_compatibility` implementieren: `own` und `organization` erlauben credential-sichtbare Inhalte nur nach frischem Same-Credential-Pre-Read und normaler Action-Autorisierung.
- [x] 3.2 Update, Publish, Archive, Restore und Hard Delete jeweils an ihre eigene fully-qualified Action-Permission und die bestätigte Typ-/Aktionsmatrix binden.
- [x] 3.3 `own` automatisch exakt auswerten, sobald die aktuelle persönliche Credential-Version konfliktfrei gebunden ist.
- [x] 3.4 `organization` automatisch exakt auswerten, sobald persönliche und aktive organisatorische Credential-Version konfliktfrei gebunden sind; ohne aktive Organisation auf `own` zurückfallen.
- [x] 3.5 `all` ohne Mapping, aber nur innerhalb der Instanz und der tatsächlichen Mainserver-Sichtbarkeit des verwendeten Read-Kontexts auswerten.
- [x] 3.6 Projection- oder Cache-Treffer niemals als Mutationsautorisierung akzeptieren; `401`, `403` und `404` beim Pre-Read fail-closed behandeln.
- [x] 3.7 Automatische Scope-Wechsel, Konflikte und Rückfälle auditieren, metrisch zählen und in Administration/Diagnose anzeigen.
- [x] 3.8 Listen-, Detail- und Mutationsregeln für persönliche und organisatorische Credential-Kontexte testen.
- [x] 3.9 Implizite `org_or_personal`-Reads auf persönliche Credentials festlegen und automatische sowie explizite Principal-Projektionsscopes gegeneinander isolieren.

## 4. Create, Delete und persistente Reconciliation

- [x] 4.1 Create-Scope-Matrix implementieren: `own` nur `user`; `organization` `user` oder aktive Organisation; `all` beide Principals; Principal-Policy darf weiter einschränken.
- [x] 4.2 Create-Response beziehungsweise Same-Credential-Re-Read gegen bestehende Bindung prüfen und Mapping automatisch erzeugen oder bestätigen.
- [x] 4.3 Provider-Konflikt nach bestätigtem Create als `reconciliation_required` behandeln, ohne den Upstream-Erfolg umzudeuten.
- [x] 4.4 Vor Hard Delete DataProvider und Audit-Preimage mit Operationsreferenz persistieren; nach Erfolg einen Tombstone finalisieren und keinen Post-Delete-Read verlangen.
- [x] 4.5 Persistentes Mutation-Journal für Principal, Credential-Fingerprint, erwarteten/tatsächlichen Provider, Teiloperationen, Provider-Outcome, Retry und Reconciliation ergänzen.
- [x] 4.6 Lost-Response-, Duplicate-, Partial-Success-, Retry-, Tombstone- und idempotente Finalisierungstests ergänzen.
- [x] 4.7 Eine erst im Same-Credential-Re-Read beobachtete Create-DataProvider-ID an Mutation-Journal und Audit derselben Operation weiterreichen.

## 5. Mainserver-Routen, Projektionen und Content-Typen

- [x] 5.1 News-, Event-, POI-, Generic-Item- und Survey-Routen sowie FAQ-, Cockpit-Card- und Projects-Fassaden auf den gemeinsamen Principal- und Autorisierungsvertrag umstellen.
- [x] 5.2 DataProvider in allen bestätigten Detail-, Create- und Update-Adaptern typisiert selektieren und als sicherheitskritisches Feld behandeln.
- [x] 5.3 Projektionen um Credential-Quelle, Credential-Fingerprint und aktuellen Bindungs-/Kompatibilitätszustand ergänzen; synthetische Owner nicht als Mapping-Beweis verwenden.
- [x] 5.4 Alle Create-, Update-, Publish-, Archive-, Restore- und Delete-Pfade ausschließlich entsprechend der Typ-/Aktionsmatrix aktivieren.
- [x] 5.5 Bestehende GraphQL-`author`-Werte bei News und Generic Items serverseitig erhalten, aber weder redaktionell anbieten noch bei Create setzen.
- [x] 5.6 Projects-Autorvertrag kompatibel migrieren und lokale Autorenmetadaten weder als Mapping noch als IAM-Owner verwenden.
- [x] 5.7 Route-/Service-Integrationstests für beide Principal-Typen, alle Scopes, Kompatibilitätsmodus, exakte Auswertung und Konflikte ergänzen.

## 6. Editor, Audit, History und Betrieb

- [x] 6.1 Wiederverwendbare, barrierefreie und übersetzte Controls für „Erstellen als“ und „Handeln als“ sowie die read-only DataProvider-Anzeige implementieren.
- [x] 6.2 Einen Principal-Wechsel gegenüber dem geladenen Credential-Kontext durch einen neuen Same-Credential-Pre-Read validieren.
- [x] 6.3 Eigenständige Aktionen nur bei `org_only` explizit als `organization`, bei `org_or_personal`, fehlender Richtlinie oder ohne aktive Organisation als `user` ausführen und serverseitig erneut validieren.
- [x] 6.4 Audit um Actor, Principal, aktive Organisation, Credential-Quelle/Fingerprint, DataProvider, Autorisierungsmodus, Action, Ergebnis und Operationsreferenz erweitern.
- [x] 6.5 Bestehenden host-owned History-Vertrag um `coverage = studio_mutations` und korrelierte erfolgreiche Mainserver-Mutationen erweitern; keine zweite History-Pipeline einführen.
- [x] 6.6 Admin-Diagnose für Bindungen, Konflikte, Rotation, Kompatibilitätsmodus, automatische Scope-Wechsel und Reconciliation ergänzen; keine manuelle Mapping-Funktion bereitstellen.
- [x] 6.7 UI-, Audit-, History-, Datenschutz- und Accessibility-Tests ergänzen.

## 7. Rollout und Dokumentation

- [ ] 7.1 Mapping, Projection-Felder und Mutation-Journal additiv ausrollen und zunächst ausschließlich im Shadow-Modus befüllen.
- [ ] 7.2 Automatische Bindungs- und Zugriffsdifferenzen je Instanz und Scope-Kontext auswerten, bevor neue Scope-Entscheidungen aktiviert werden.
- [x] 7.3 `actingPrincipalType` versioniert aktivieren, damit offene ältere Browser-Clients während des Übergangs deterministisch behandelt werden.
- [ ] 7.4 Exakte Scopes und `credential_visible_compatibility` nach bestätigten Mainserver-Verträgen aktivieren; rollbackfähigen Resolverpfad beibehalten.
- [x] 7.5 Betroffene arc42-Abschnitte 05, 06, 08 und 09 sowie relevante Content-, IAM-, Mainserver- und History-Dokumentation aktualisieren.
- [x] 7.6 Kleinste relevante Unit-, Type-, Server-Runtime-, Datenbank-, File-Placement- und reale E2E-Gates ausführen; anschließend den gemessenen affected Scope bewerten.
- [x] 7.7 Nach Verfügbarkeit stabiler Identity-IDs automatische Verifikation aktivieren und den Kompatibilitätspfad erst entfernen, wenn produktive Metriken keine Nutzung mehr zeigen.
