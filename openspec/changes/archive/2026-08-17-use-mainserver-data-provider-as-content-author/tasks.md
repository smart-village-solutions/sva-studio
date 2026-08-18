## 0. Abhängigkeiten und reale Mainserver-Verträge

- [x] 0.1 Die Changes `make-mainserver-content-authoritative`, `update-mainserver-editor-resilience` und `standardize-plugin-content-history` mit dem DataProvider-, Credential- und History-Vertrag komponieren.
- [x] 0.2 Pro Content-Typ und fachlicher Aktion eine verbindliche Matrix aus Action-ID, Mainserver-Operation, Pre-Read, DataProvider-Response, Lifecycle, Cross-Principal-Verhalten, Idempotenz und Reconciliation dokumentieren.
- [x] 0.3 Einen risikobasierten realen Staging-Canary mit persönlichen und organisatorischen Credentials ausführen: beide Identity-Bindungen, je ein erfolgreicher Create-/Bestandsmutationspfad, ein Cross-Principal-Negativfall, unveränderter ursprünglicher DataProvider und kein neuer ungeklärter Reconciliation-Fall. Die typisierten Adapter- und Lifecycle-Verträge der übrigen Content-Typen bleiben durch Integrationstests und Capability-Gates abgesichert; ein reales Kreuzprodukt aller Typen und Aktionen ist kein Production-Gate.
- [x] 0.4 Nicht bestätigte Typ-/Aktionskombinationen capability-gaten; `surveys.create` bleibt aufgrund der ausdrücklichen Produktfreigabe aktiv, die reale persönliche und organisatorische Vertragsevidenz wird nachgeholt.
- [x] 0.5 `/data_provider.json` mit demselben Bearer Token wie GraphQL integrieren, die stabile ID verpflichtend validieren und PII-haltige Rohdaten ausschließen.

## 1. Automatische DataProvider-Bindungen

- [x] 1.1 Instanzgebundene, credential-versionierte Principal-Bindungen mit `pending`, `verified`, `conflict`, `historical` und `revoked` modellieren.
- [x] 1.2 Bindungen ausschließlich aus automatischer bestätigter Evidenz erzeugen: regulär `/data_provider.json`, zusätzlich die garantierte Benutzer-Provisioning-Antwort für neue Organisations-Credentials; Listen, normale Details, Updates, Deletes, Namen und administrative Eingaben als Beweis ausschließen.
- [x] 1.3 Gleiche Create-Beobachtungen idempotent bestätigen; abweichende Provider-IDs und konkurrierende Principal-Claims als Konflikt persistieren, ohne bestehende Bindungen zu überschreiben.
- [x] 1.4 Credential-Rotation über Fingerprint beziehungsweise Version isolieren und historische Bindungen für bestehende Inhalte erhalten.
- [x] 1.5 Stabile Identity-IDs als reguläre automatische Evidenz implementieren; Gleichheit bestätigt auch eine garantierte Organisations-Erstbindung, Abweichung erzeugt Konflikt.
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
- [x] 3.4 `organization` unabhängig von `contentAuthorPolicy` automatisch exakt als persönlicher plus aktiver organisatorischer DataProvider auswerten, sobald die laut Read-Contract erforderlichen Credential-Versionen konfliktfrei gebunden sind; ohne aktive Organisation auf `own` zurückfallen.
- [x] 3.5 `all` ohne Mapping, aber nur innerhalb der Instanz und der tatsächlichen Mainserver-Sichtbarkeit des verwendeten Read-Kontexts auswerten.
- [x] 3.6 Projection- oder Cache-Treffer niemals als Mutationsautorisierung akzeptieren; `401`, `403` und `404` beim Pre-Read fail-closed behandeln.
- [x] 3.7 Automatische Scope-Wechsel, Konflikte und Rückfälle auditieren, metrisch zählen und in Administration/Diagnose anzeigen.
- [x] 3.8 Listen-, Detail- und Mutationsregeln für persönliche und organisatorische Credential-Kontexte an der getrennten Read-, Create- und Bestandsmutationssemantik testen.
- [x] 3.9 Im realen Staging-Canary bestätigen, dass getrennte persönliche und organisatorische Credential-Sichten zusammen `own ∪ aktive Organisation` ergeben und ein fremder persönlicher Provider ausgeschlossen bleibt. Ein repräsentativer Mainserver-Content-Typ genügt, weil die übrigen Typen denselben zentralen Projection- und Autorisierungsvertrag verwenden.
- [x] 3.10 Getrennte persönliche und organisatorische Projection-Sichten unabhängig von `contentAuthorPolicy` als gemeinsame Read-Strategie für `own ∪ aktive Organisation` implementieren.
- [x] 3.11 Projection, Cache, Sync-State und Snapshot je Principal isolieren, vor Sortierung und Pagination nach stabiler Mainserver-Identität deduplizieren und bei Teilausfällen einen sichtbaren Hinweis sowie eine unvollständige Gesamtzahl ausgeben.
- [x] 3.12 Unit- und Integrationstests für identische Read-Semantik unter `org_only` und `org_or_personal`, eigene plus organisatorische Inhalte, Deduplizierung, globale Pagination, Organisationswechsel, Teilausfälle und getrennte Snapshots ergänzen.

## 4. Create, Delete und persistente Reconciliation

- [x] 4.1 Create-Scope-Matrix implementieren: `own` nur `user`; `organization` `user` oder aktive Organisation; `all` beide Principals; Principal-Policy darf weiter einschränken.
- [x] 4.2 Create-Response beziehungsweise Same-Credential-Re-Read gegen die bereits per Identity-Endpunkt oder garantierter Organisations-Provisioning-Antwort erzeugte Bindung prüfen und ausschließlich bestätigen; normale Content-Responses begründen kein Mapping.
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
- [x] 5.7 Route-/Service-Integrationstests für beide Principal-Typen, alle Scopes, Create-Policy, ownership-gebundene Bestandsmutationen, Kompatibilitätsmodus, exakte Auswertung und Konflikte ergänzen.

## 6. Editor, Audit, History und Betrieb

- [x] 6.1 Wiederverwendbare, barrierefreie und übersetzte Controls für die Create-Auswahl „Erstellen als“ sowie die read-only DataProvider- und Ownership-Principal-Anzeige bei Bestandsinhalten implementieren; dort keinen freien „Handeln als“-Wechsel anbieten.
- [x] 6.2 Bei bestehenden eigenen oder organisatorischen Inhalten den durch Ownership-Bindung und Ressourcen-Capability bestimmten Principal festlegen, abweichende Client-Auswahlen zurückweisen und den Same-Credential-Pre-Read mit diesem Principal validieren; administrative `all`-/Moderationsaktionen verwenden ausschließlich den von der Ressourcen-Capability erlaubten Organisations- oder Benutzerprincipal.
- [x] 6.3 Eigenständige Aktionen für bestehende Inhalte ressourcenbezogen ausführen; keinen dritten Admin-Principal, keine Ableitung aus einem Projection-Treffer und keinen stillen Credential-Fallback zulassen.
- [x] 6.4 Audit um Actor, Principal, aktive Organisation, Credential-Quelle/Fingerprint, DataProvider, Autorisierungsmodus, Action, Ergebnis und Operationsreferenz erweitern.
- [x] 6.5 Bestehenden host-owned History-Vertrag um `coverage = studio_mutations` und korrelierte erfolgreiche Mainserver-Mutationen erweitern; keine zweite History-Pipeline einführen.
- [x] 6.6 Admin-Diagnose für Bindungen, Konflikte, Rotation, Kompatibilitätsmodus, automatische Scope-Wechsel und Reconciliation ergänzen; keine manuelle Mapping-Funktion bereitstellen.
- [x] 6.7 UI-, Audit-, History-, Datenschutz- und Accessibility-Tests ergänzen.
- [x] 6.8 `GET /api/v1/iam/me/context` additiv um `contentAuthorPolicy` erweitern und den administrativen Organisationsdetail-Read aus allen Content-Routen entfernen.
- [x] 6.9 Einen zentralen, exakt an `activeOrganizationId` gebundenen Create-Principal-Resolver mit explizitem `unavailable`-Zustand für fehlende, ladende, wechselnde oder widersprüchliche Organisationskontexte implementieren; Inhaltslisten bleiben dabei ohne Mainserver-Mutationsfähigkeiten lesbar.
- [x] 6.10 Eigenständige Status- und Delete-Aktionen der Inhaltsliste vorrangig an die projizierte Credential-Quelle des konkreten Inhalts binden; bei auswählbarer Create-Policy ohne Ressourcenprincipal fail-closed sperren.
- [x] 6.11 Die ressourcenbezogene Ownership-Principal-Auflösung und read-only Anzeige in allen Bestandseditoren fertigstellen; die Create-Policy darf persönliche Bestandsinhalte unter `org_only` nicht auf die Organisation umstellen.
- [x] 6.12 Contract-, Route- und Plugin-Integrationstests für persönliche Bestandsinhalte unter `org_only`, inaktive Principals, administrative Ressourcen-Capabilities und fail-closed Editorzustände ergänzen.

## 7. Rollout und Dokumentation

- [x] 7.1 Mapping, Projection-Felder und Mutation-Journal additiv ausrollen und zunächst ausschließlich im Shadow-Modus befüllen.
- [x] 7.2 Automatische Bindungs- und Zugriffsdifferenzen je Instanz und Scope-Kontext als Nacharbeit auswerten und vor einer Production-Aktivierung bewerten.
- [x] 7.3 `actingPrincipalType` versioniert aktivieren, damit offene ältere Browser-Clients während des Übergangs deterministisch behandelt werden.
- [x] 7.4 Vor einer Production-Aktivierung die persönliche und organisatorische Vertragsevidenz vervollständigen und den rollbackfähigen Resolverpfad beibehalten; Development und Staging bleiben aufgrund der ausdrücklichen Produktentscheidung auf `automatic`.
- [x] 7.5 Eine neue ADR für die Trennung aus Create-Policy, IAM-Read-Scope und ressourcenbezogener Bestandsmutation erstellen, ADR-045 damit supersedieren und die weiterhin gültigen Credential-, Secret- und Isolationsentscheidungen ausdrücklich übernehmen.
- [x] 7.6 Betroffene arc42-Abschnitte 05, 06, 08 und 09 sowie relevante Content-, IAM-, Mainserver- und History-Dokumentation an den freigegebenen Vertrag anpassen.
- [x] 7.7 Die kleinsten relevanten Unit-, Type-, Server-Runtime-, Datenbank-, File-Placement- und realen E2E-Gates ausführen und anschließend den gemessenen affected Scope bewerten; die abschließenden PR-Gates für #1050 waren am exakten Head vollständig grün.
- [x] 7.8 Nach Verfügbarkeit stabiler Identity-IDs automatische Verifikation aktivieren und den Kompatibilitätspfad erst entfernen, wenn produktive Metriken keine Nutzung mehr zeigen.
- [x] 7.9 Den autoritativen Production-Config-Builder mit Legacy-Secret-Bridge über Dev, Staging und Production ausrollen und den effektiven Resolverwert `automatic` live bestätigen; Production-Run `32028385009`, Live-Digest `sha256:81f47ae9a264d6095584162b5789661c786d45d18d3c4324ed3e7b7609490603`, `health/live` und `health/ready` jeweils HTTP 200.

## 8. Stabilen Identity-Vertrag zum Zielzustand machen

- [x] 8.1 `data_provider.id` als verpflichtende String- oder Ganzzahl-ID validieren und fehlende, leere oder strukturell ungültige IDs fail-closed behandeln.
- [x] 8.2 Vor jeder Mutation eine verifizierte Bindung für den aktuellen Credential-Fingerprint sicherstellen; vorhandene aktuelle Bindungen als Cache verwenden.
- [x] 8.3 Identity-, Datenbank- und Mapping-Konflikte vor dem Provider-Write deterministisch ablehnen und ohne PII protokollieren.
- [x] 8.4 Resolvermodus in allen getrackten Remote-Profilen explizit als validierten Rolloutwert materialisieren.
- [x] 8.5 Parser-, Identity-, Rotation-/Cache-, Konflikt-, Policy- und Remote-Config-Tests ergänzen.
- [x] 8.6 Development im getrackten Remote-Profil auf `automatic` konfigurieren.
- [x] 8.7 Staging im getrackten Remote-Profil auf `automatic` konfigurieren; Production bis zur risikobasierten Staging-Abnahme auf `shadow` belassen und danach kontrolliert auf `automatic` umstellen.
- [x] 8.8 Die Deployment-Umgebung unabhängig von `NODE_ENV` explizit als `development`, `staging` oder `production` materialisieren und als OTEL-`deployment.environment` verwenden.

## 9. Gelöschte Benutzer

- [x] 9.1 Für lokale IAM-Inhalte die konfigurierte Löschregel anwenden: Inhalt als gelöscht markieren oder ohne aktive Benutzerzuordnung mit `NULL` und neutralem Autor-Token weiterführen; keine automatische Eigentumsübertragung vornehmen.
- [x] 9.2 Mainserver-Bindungen gelöschter, pseudonymisierter oder blockierter Accounts aus der aktuellen Readiness ausschließen; lokale Projektionen entfernen aktive Benutzerzuordnungen beziehungsweise verwenden die neutrale Anzeige „Gelöschter Benutzer“, ohne Ownership zu übertragen.
- [x] 9.3 Lifecycle-, Scope-, Anzeige-, Audit- und Retention-Verträge für gelöschte beziehungsweise pseudonymisierte Accounts mit den vorhandenen Account-Delete-, Binding- und Projection-Tests absichern.
