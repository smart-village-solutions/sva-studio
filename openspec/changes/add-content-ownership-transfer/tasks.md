## 0. Vertrags- und Scope-Preflight

- [ ] 0.1 Die V1-Matrix für NewsItem, EventRecord, PointOfInterest, Tour und Root-GenericItem einschließlich abhängiger Datensätze gegen den aktuellen Mainserver-Vertrag und Mainserver-Commit `ee619d0e` dokumentieren.
- [ ] 0.2 In Dev und Staging per Schema-/Contract-Preflight nachweisen, dass die fünf Resource-Mutationen `dataProviderId` akzeptieren und instanz-/municipality-fremde Ziele ablehnen; bei fehlendem Vertrag die Studio-Aktivierung blockieren.
- [ ] 0.3 Surveys, Legacy SurveyPolls, Batch-Importe und nicht bestätigte Typen explizit als nicht unterstützt in derselben Capability-Matrix abbilden.
- [ ] 0.4 Überschneidungen mit `add-mainserver-user-conflict-reconciliation`, `auto-reconcile-deleted-user-data-provider-conflicts` und laufenden Principal-Reconciliation-Änderungen prüfen; keine Transfersemantik in diese Changes verschieben.

## 1. Permission- und Autorisierungsvertrag

- [ ] 1.1 `content.transferOwnership` als typsichere Primitive-/Domain-Action mit Scope-Unterstützung in den kanonischen Content- und Permission-Katalog aufnehmen.
- [ ] 1.2 Seed, Bootstrap und additive Reconciliation für bestehende Tenants aus dem kanonischen Katalog ableiten; `system_admin` erhält Scope `all`, andere Rollen keine implizite Freigabe.
- [ ] 1.3 Lokale Ownership-Feldänderungen aus `content.updateMetadata` herauslösen und ausschließlich über den Transferpfad autorisieren.
- [ ] 1.4 Source-Scope gegen den aktuellen Inhalt prüfen; Ziel-Account oder Ziel-Organisation ausschließlich auf Aktivstatus, Instanz, Typ und Zielvertragsfähigkeit validieren.
- [ ] 1.5 Autorisierungs-, Katalog-, Scope- und Privilege-Escalation-Regressionstests ergänzen.

## 2. Ziel-Principal-Auflösung

- [ ] 2.1 Einen serverseitigen, paginierten Zielkatalog für aktive Accounts und Organisationen derselben Instanz mit PII-minimiertem Anzeigemodell bereitstellen.
- [ ] 2.2 Für Mainserver-Inhalte nur Ziele mit eindeutiger, konfliktfreier, aktueller DataProvider-Bindung und verwendbaren persönlichen beziehungsweise organisatorischen Credentials zulassen.
- [ ] 2.3 Ziel-Principal und Binding-Version unmittelbar vor der Mutation unter dem bestehenden DataProvider-Lock erneut prüfen.
- [ ] 2.4 Freie DataProvider-, Credential-, Account- oder Organisationswerte außerhalb des typisierten Ziel-Principal-Vertrags im Request-Schema ablehnen.
- [ ] 2.5 Tests für gelöschte, gesperrte, instanzfremde, credential-lose, mehrdeutige und konfliktbehaftete Ziele ergänzen.

## 3. Lokaler Content-Transfer

- [ ] 3.1 Einen atomaren lokalen Transferbefehl implementieren, der genau einen Owner-Typ setzt und den jeweils anderen Owner entfernt.
- [ ] 3.2 Die sichtbare Autorenanzeige lokaler Inhalte unverändert lassen und dies in Repository-, History- und API-Tests absichern.
- [ ] 3.3 Nach erfolgreichem Transfer Read-Sicht und Response so behandeln, dass ein erwarteter Zugriffsverlust des Actors den Erfolg nicht widerruft.

## 4. Typisierter Mainserver-Transfer

- [ ] 4.1 Den verifizierten Mainserver-Schema-Snapshot aktualisieren und die optionalen `dataProviderId`-Variablen für News, Events, POI, Touren und GenericItems typsicher generieren.
- [ ] 4.2 Einen server-only Transferadapter ergänzen, der Quell-Principal und Ziel-Principal trennt und niemals DataProvider-IDs aus dem Browser übernimmt.
- [ ] 4.3 Fresh Same-Credential-Pre-Read, Transfer-Permission, Quell-DataProvider, Zielbindung und Typ-Capability vor dem Provider-Write erneut prüfen.
- [ ] 4.4 Eine stabile Operationsreferenz im bestehenden Mainserver-Mutationsjournal reservieren und erwarteten Quell- sowie Ziel-DataProvider festhalten.
- [ ] 4.5 Nach bestätigtem Transfer Response beziehungsweise Target-Re-Read validieren und Projektion, Credential-Quelle, Liste, History und Audit auf den Ziel-Principal nachziehen.
- [ ] 4.6 Bei verlorenem Response zuerst Target-, danach Source-Re-Read ausführen; nur eindeutige Evidenz finalisieren oder wiederholen, sonst `reconciliation_required` setzen.
- [ ] 4.7 Sicherstellen, dass lokale Folgefehler einen bestätigten Mainserver-Erfolg nicht als Provider-Fehler oder Rollback darstellen.
- [ ] 4.8 Contract- und Integrationstests für Root-/Abhängigkeitsübertragung, ExternalReference-Konsistenz, Retry, Timeout, Konflikt und Reconciliation ergänzen.

## 5. Gemeinsame Oberfläche

- [ ] 5.1 Eine gemeinsame shadcn/ui-basierte Aktion „Inhalt übergeben“ mit Target-Suche, aktuellem/neuem Inhaber, Wirkungswarnung und expliziter Bestätigung implementieren.
- [ ] 5.2 Die Aktion ausschließlich bei effektiver `content.transferOwnership`-Permission und positiver serverseitiger Typ-Capability anbieten.
- [ ] 5.3 V1-Plugins über den gemeinsamen Host-Vertrag anbinden, ohne pluginlokale Zielauflösung oder Transferlogik zu duplizieren.
- [ ] 5.4 Lokalisierte Erfolgs-, Denial-, Binding-, Credential-, Unsupported- und Reconciliation-Meldungen für Deutsch und Englisch ergänzen.
- [ ] 5.5 Fokusführung, Tastaturbedienung, Screenreader-Namen, Lade-/Disabled-State und 44×44-Zielgrößen mit Unit-, Axe- und E2E-Tests absichern.

## 6. Audit, Observability und Dokumentation

- [ ] 6.1 Append-only Audit für Actor, Action, Content-ID/-Typ, Source-/Target-Principal, alte/neue DataProvider-Referenz, Operationsreferenz, Binding-Version, Ergebnis und Reconciliation-Status ergänzen, ohne PII oder Secrets zu speichern.
- [ ] 6.2 Strukturierte Metriken und Logs für Erfolg, Denial, Target-Validierung, Upstream-Rejection, Timeout und `reconciliation_required` ergänzen.
- [ ] 6.3 Content-/IAM-Bedienungsdokumentation, Permission-Referenz und Mainserver-Runbook auf Deutsch aktualisieren.
- [ ] 6.4 Eine ADR zum kontrollierten Content-Inhabertransfer erstellen und die arc42-Abschnitte 03, 04, 05, 06, 08 und 09 aktualisieren.
- [ ] 6.5 Prüfen und dokumentieren, dass keine Studio-Datenbankschemaänderung erforderlich ist; falls die Implementierung doch Schemaänderungen benötigt, `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` im selben Änderungsblock fortschreiben.
- [ ] 6.6 Nutzerverständlichen Studio-Changelog-Eintrag ergänzen.

## 7. Abnahme und Rollout

- [ ] 7.1 Die Matrix Account→Account, Account→Organisation, Organisation→Account und Organisation→Organisation für jeden V1-Typ mit klar markierten Testdaten in Dev und Staging prüfen.
- [ ] 7.2 Negative Abnahme für fehlende Permission, falschen Scope, instanz-/municipality-fremdes Ziel, stale Binding, fehlende Credentials, unsupported Typ und parallele Mutation durchführen.
- [ ] 7.3 Bestehende Abnahme-Principals ohne Mainserver-Rolle `studio` kontrolliert reprovisionieren und die Rollenwirkung getrennt vom Content-Transfer nachweisen.
- [ ] 7.4 Nach jedem Transfer Mainserver-DataProvider, abhängige Datensätze, ExternalReference, Studio-Projektion, neue Read-Sicht, History und Audit verifizieren.
- [ ] 7.5 Relevante Unit-, Type-, Server-Runtime-, Integration-, Accessibility- und E2E-Gates sowie `pnpm test:pr` vor dem initialen PR-Push ausführen.
- [ ] 7.6 Erforderliche Mainserver-Version und Studio über die jeweils geschützten kanonischen Rolloutpfade ausrollen; Production erst nach positiver Staging-Matrix und expliziter Freigabe promoten.
