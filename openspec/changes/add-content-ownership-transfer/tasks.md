## 0. Vertrags- und Scope-Preflight

- [x] 0.1 Die V1-Matrix für NewsItem, EventRecord, PointOfInterest, Tour und Root-GenericItem einschließlich abhängiger Datensätze gegen den aktuellen Mainserver-Vertrag und Mainserver-Commit `ee619d0e` dokumentieren.
- [ ] 0.2a In Dev per Schema-/Contract-Preflight nachweisen, dass die fünf Resource-Mutationen `dataProviderId` akzeptieren und instanz-/municipality-fremde Ziele ablehnen; bei fehlendem Vertrag die Studio-Aktivierung blockieren.
- [x] 0.2b In Staging per Schema-/Contract-Preflight nachweisen, dass die fünf Resource-Mutationen `dataProviderId` akzeptieren und instanz-/municipality-fremde Ziele ablehnen. Die vollständige positive und negative Staging-Abnahme wurde am 27.08.2026 bestätigt.
- [x] 0.3 Surveys, Legacy SurveyPolls, Batch-Importe und nicht bestätigte Typen explizit als nicht unterstützt in derselben Capability-Matrix abbilden.
- [x] 0.4 Überschneidungen mit `add-mainserver-user-conflict-reconciliation`, `auto-reconcile-deleted-user-data-provider-conflicts` und laufenden Principal-Reconciliation-Änderungen prüfen; keine Transfersemantik in diese Changes verschieben.

## 1. Permission- und Autorisierungsvertrag

- [x] 1.1 `content.transferOwnership` als typsichere Primitive-/Domain-Action mit Scope-Unterstützung in den kanonischen Content- und Permission-Katalog aufnehmen.
- [x] 1.2 Seed, Bootstrap und additive Reconciliation für bestehende Tenants aus dem kanonischen Katalog ableiten; `system_admin` erhält Scope `all`, andere Rollen keine implizite Freigabe.
- [x] 1.3 Lokale Ownership-Feldänderungen aus `content.updateMetadata` herauslösen und ausschließlich über den Transferpfad autorisieren.
- [x] 1.4 Source-Scope gegen den aktuellen Inhalt prüfen; Ziel-Account oder Ziel-Organisation ausschließlich auf Aktivstatus, Instanz, Typ und Zielvertragsfähigkeit validieren.
- [x] 1.5 Autorisierungs-, Katalog-, Scope- und Privilege-Escalation-Regressionstests ergänzen.

## 2. Ziel-Principal-Auflösung

- [x] 2.1 Einen serverseitigen, paginierten Zielkatalog für aktive Accounts und Organisationen derselben Instanz mit PII-minimiertem Anzeigemodell bereitstellen; Organisationen sind suchbar, Accounts werden in V1 ohne neue Suche über verschlüsselte PII paginiert.
- [x] 2.2 Für Mainserver-Inhalte Ziele mit eindeutiger, konfliktfreier, aktueller DataProvider-Bindung und verwendbaren persönlichen beziehungsweise organisatorischen Credentials direkt zulassen; bei verwendbaren Credentials ohne gespeicherte Bindung den Kandidaten als `verification_required` anbieten.
- [x] 2.3 Ziel-Principal und Binding-Version unmittelbar vor der Mutation unter dem bestehenden DataProvider-Lock erneut prüfen.
- [x] 2.4 Freie DataProvider-, Credential-, Account- oder Organisationswerte außerhalb des typisierten Ziel-Principal-Vertrags im Request-Schema ablehnen.
- [x] 2.5 Tests für gelöschte, gesperrte, instanzfremde, credential-lose, mehrdeutige und konfliktbehaftete Ziele ergänzen.
- [x] 2.6 Fehlende Zielbindungen erst nach ausdrücklicher Transferbestätigung für genau den gewählten Principal über `/data_provider.json` verifizieren, konfliktbewusst persistieren und erneut auflösen; Zielkatalog und Pagination lösen keine externen Identity-Aufrufe je Treffer aus.

## 3. Lokaler Content-Transfer

- [x] 3.1 Einen atomaren lokalen Transferbefehl implementieren, der genau einen Owner-Typ setzt und den jeweils anderen Owner entfernt.
- [x] 3.2 Die sichtbare Autorenanzeige lokaler Inhalte unverändert lassen und dies in Repository-, History- und API-Tests absichern.
- [x] 3.3 Nach erfolgreichem Transfer Read-Sicht und Response so behandeln, dass ein erwarteter Zugriffsverlust des Actors den Erfolg nicht widerruft.

## 4. Typisierter Mainserver-Transfer

- [x] 4.1 Im verifizierten Mainserver-Schema-Snapshot die optionalen `dataProviderId`-Argumente für News, Events, POI, Touren und GenericItems bestätigen; die vier vorhandenen Studio-Adapter typsicher anbinden und Touren mangels redaktionellem Studio-Editor capability-gated lassen.
- [x] 4.2 Einen server-only Transferadapter ergänzen, der autorisierten Actor und Ziel-Principal trennt und niemals DataProvider-IDs aus dem Browser übernimmt.
- [x] 4.3 Fresh Actor-Credential-Pre-Read, Transfer-Permission, Quell-DataProvider, Zielbindung und Typ-Capability vor dem Provider-Write erneut prüfen; bei Scope `all` Source-Principal-Lifecycle und -Credentials nicht als Gate verwenden.
- [x] 4.4 Eine stabile Operationsreferenz im bestehenden Mainserver-Mutationsjournal reservieren und erwarteten Quell- sowie Ziel-DataProvider festhalten.
- [x] 4.5 Nach bestätigtem Transfer Response beziehungsweise Target-Re-Read validieren und Projektion, Credential-Quelle, Liste, History und Audit auf den Ziel-Principal nachziehen.
- [x] 4.6 Bei verlorenem Response zuerst Target-, danach Actor-Re-Read ausführen; nur eindeutige Evidenz finalisieren oder wiederholen, sonst `reconciliation_required` setzen.
- [x] 4.7 Sicherstellen, dass lokale Folgefehler einen bestätigten Mainserver-Erfolg nicht als Provider-Fehler oder Rollback darstellen.
- [x] 4.8 Contract- und Integrationstests für Root-/Abhängigkeitsübertragung, ExternalReference-Konsistenz, Retry, Timeout, Konflikt und Reconciliation ergänzen; Root-/Abhängigkeits- und ExternalReference-Transaktion sind in der Mainserver-Baseline `ee619d0e`, Adapter-/Retry-/Reconciliation-Pfade im Studio abgesichert.
- [x] 4.9 `content.transferOwnership` nach bestätigter Staging-Matrix dauerhaft als Code-Capability aktivieren und den betrieblichen Laufzeitschalter aus dem Transferpfad entfernen.
- [x] 4.10 Identity-Ausfall und beim anlassbezogenen Nachweis entdeckte Binding-Konflikte vor dem Provider-Write mit stabilen Fehlercodes und Journalstatus fail-closed behandeln.

## 5. Gemeinsame Oberfläche

- [x] 5.1 Einen gemeinsamen `ContentOwnershipPanel`-Vertrag getrennt von „Bearbeiten als“ implementieren; bei Mainserver-Inhalten den aktuellen Inhaber ausschließlich aus dem frisch gelesenen Content-DataProvider ableiten.
- [x] 5.2 Den Inhaberbereich im Bearbeitungsmodus der vorhandenen Editoren für News, Events, POI, generische Inhalte, FAQ, Cockpit Cards, Featured Projects und Surveys genau einmal am Anfang des ersten fachlichen Tabs integrieren; im Create-Modus nur den getrennten Erstellungsprincipal zeigen.
- [x] 5.3 Die einheitliche Anzeige auch für nicht transferfähige Typen bereitstellen und dort die fehlende Transferunterstützung verständlich kennzeichnen, ohne eine aktive Aktion anzubieten.
- [x] 5.4 Einen dauerhaften Ownership-Hinweis im Inhaberbereich und eine kompakte Wiederholung an der Speichern-Aktion ergänzen: normales Speichern ändert den Inhaber nicht; Transferberechtigung und abweichender Mutationsprincipal werden verständlich erklärt.
- [x] 5.5 Eine gemeinsame shadcn/ui-basierte Aktion „Inhalt übertragen“ mit serverseitig paginierter Zielauswahl implementieren; persönliche Accounts und Organisationen klar filtern, Organisationen suchbar machen und jeden Treffer textlich typisieren, ohne für Accounts eine neue PII-Suchinfrastruktur oder für Mainserver-Kandidaten exakte Gesamtzahlen vorauszusetzen.
- [x] 5.6 Aktuellen Inhaber sowie inaktive, gelöschte, konfliktbehaftete und credential-lose Ziele aus der Auswahl ausschließen; keine freie DataProvider-ID und standardmäßig keine E-Mail-Adresse darstellen.
- [x] 5.7 Einen Prüfschritt „Aktueller Inhaber → Neuer Inhaber“ mit Typ, Name, Auswirkung auf die Autorenanzeige, möglichem Zugriffsverlust und expliziter Bestätigung umsetzen.
- [x] 5.8 Die Aktion ausschließlich bei effektiver `content.transferOwnership`-Permission und positiver serverseitiger Typ-Capability aktivieren; V1-Plugins ohne pluginlokale Zielauflösung oder Transferlogik anbinden.
- [x] 5.9 Nach Erfolg zuerst bestätigendes Feedback zeigen, den aktuellen Inhaber neu laden und bei verlorenem Detailzugriff anschließend kontrolliert in die Inhaltsliste navigieren.
- [x] 5.10 Lokalisierte Erfolgs-, Denial-, Binding-, Credential-, Unsupported-, Ownership-Hinweis- und Reconciliation-Meldungen für Deutsch und Englisch ergänzen.
- [x] 5.11 Fokusführung, Tastaturbedienung, Screenreader-Namen, Lade-/Disabled-State und 44×44-Zielgrößen mit Unit-, Axe- und E2E-Tests absichern.
- [x] 5.12 Konformitätstests ergänzen, die je registriertem Content-Editor genau eine Inhaberanzeige im ersten Tab, den Save-Hinweis und die permission-/capability-gesteuerte Transferaktion nachweisen.
- [x] 5.13 Ziele mit anlassbezogener Binding-Prüfung in Auswahl und Bestätigung lokalisiert kennzeichnen.

## 6. Audit, Observability und Dokumentation

- [x] 6.1 Append-only Audit für Actor, Action, Content-ID/-Typ, optionalen Source-Principal-Auflösungszustand, Target-Principal, alte/neue DataProvider-Referenz, Operationsreferenz, Binding-Version, Ergebnis und Reconciliation-Status ergänzen, ohne PII oder Secrets zu speichern; Coverage ausdrücklich als `studio_mutations` kennzeichnen.
- [x] 6.2 Strukturierte Metriken und Logs für Erfolg, Denial, Target-Validierung, Upstream-Rejection, Timeout und `reconciliation_required` ergänzen.
- [x] 6.3 Content-/IAM-Bedienungsdokumentation, Permission-Referenz und Mainserver-Runbook auf Deutsch aktualisieren.
- [x] 6.4 Eine ADR zum kontrollierten Content-Inhabertransfer erstellen und die arc42-Abschnitte 03, 04, 05, 06, 08 und 09 aktualisieren.
- [x] 6.5 Prüfen und dokumentieren, dass keine Studio-Datenbankschemaänderung erforderlich ist; falls die Implementierung doch Schemaänderungen benötigt, `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` im selben Änderungsblock fortschreiben.
- [x] 6.6 Nutzerverständlichen Studio-Changelog-Eintrag ergänzen.
- [x] 6.7 Dokumentieren und testen, dass der aktuelle Inhaber nie aus Audit oder History rekonstruiert wird und eine optionale Historienanzeige auf potenziell fehlende externe Änderungen hinweist.

## 7. Abnahme und Rollout

- [ ] 7.1a Die Matrix Account→Account, Account→Organisation, Organisation→Account und Organisation→Organisation für jeden V1-Typ mit klar markierten Testdaten in Dev prüfen.
- [x] 7.1b Die Matrix Account→Account, Account→Organisation, Organisation→Account und Organisation→Organisation für jeden V1-Typ mit klar markierten Testdaten in Staging prüfen. Fachliche Abnahme am 27.08.2026 bestätigt; technischer Rollout-Nachweis: Promote-Run `33115632787`, Source-SHA `8b03ceebdaa9aa0b66a9e6be43e98dbb046f6065`, Image-Digest `sha256:2a5ce7569c49f228abfc23d47b4d8501ed71577de7db25c6ce20edf086f09052`.
- [x] 7.2 Negative Abnahme für fehlende Permission, falschen Scope, instanz-/municipality-fremdes Ziel, stale Binding, fehlende Credentials, unsupported Typ und parallele Mutation in Staging durchführen.
- [x] 7.3 Bestehende Abnahme-Principals ohne Mainserver-Rolle `studio` in Staging kontrolliert reprovisionieren und die Rollenwirkung getrennt vom Content-Transfer nachweisen.
- [x] 7.4 Nach jedem Staging-Transfer Mainserver-DataProvider, abhängige Datensätze, ExternalReference, Studio-Projektion, neue Read-Sicht, History und Audit verifizieren.
- [x] 7.5 Relevante Unit-, Type-, Server-Runtime-, Integration-, Accessibility- und E2E-Gates sowie `pnpm test:pr` vor dem initialen PR-Push ausführen. PR #1174 bestand die vollständigen GitHub-Gates einschließlich Unit, Types, Lint, A11y, Coverage, Complexity, Schema Diff und PR Integration; der kanonische Main-E2E-Nachweis für den ausgelieferten Release-SHA war ebenfalls grün.
- [ ] 7.6a Die erforderliche Mainserver-Baseline `ee619d0e` über den geschützten kanonischen Mainserver-Rolloutpfad bis Production nachweisen.
- [x] 7.6b Studio erst nach positiver Staging-Matrix und expliziter Freigabe über den geschützten kanonischen Rolloutpfad nach Production promoten. Promote-Run `33116757832` hat am 27.08.2026 Staging-Parität, Studio- und Waste-Backups, Migration, Bootstrap, Postconditions, Swarm-Konvergenz, Runtime-Smoke und Digest-Verifikation für Source-SHA `8b03ceebdaa9aa0b66a9e6be43e98dbb046f6065` und Image-Digest `sha256:2a5ce7569c49f228abfc23d47b4d8501ed71577de7db25c6ce20edf086f09052` erfolgreich abgeschlossen; `/health/live` und `/health/ready` waren anschließend bereit.
