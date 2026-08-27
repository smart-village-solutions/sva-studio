## 0. Vertrags- und Scope-Preflight

- [x] 0.1 Die V1-Matrix für NewsItem, EventRecord, PointOfInterest, Tour und Root-GenericItem einschließlich abhängiger Datensätze gegen den aktuellen Mainserver-Vertrag und Mainserver-Commit `ee619d0e` dokumentieren.
- [ ] 0.2 In Dev und Staging per Schema-/Contract-Preflight nachweisen, dass die fünf Resource-Mutationen `dataProviderId` akzeptieren und instanz-/municipality-fremde Ziele ablehnen; bei fehlendem Vertrag die Studio-Aktivierung blockieren.
- [x] 0.3 Surveys, Legacy SurveyPolls, Batch-Importe und nicht bestätigte Typen explizit als nicht unterstützt in derselben Capability-Matrix abbilden.
- [x] 0.4 Überschneidungen mit `add-mainserver-user-conflict-reconciliation`, `auto-reconcile-deleted-user-data-provider-conflicts` und laufenden Principal-Reconciliation-Änderungen prüfen; keine Transfersemantik in diese Changes verschieben.

## 1. Permission- und Autorisierungsvertrag

- [x] 1.1 `content.transferOwnership` als typsichere Primitive-/Domain-Action mit Scope-Unterstützung in den kanonischen Content- und Permission-Katalog aufnehmen.
- [x] 1.2 Seed, Bootstrap und additive Reconciliation für bestehende Tenants aus dem kanonischen Katalog ableiten; `system_admin` erhält Scope `all`, andere Rollen keine implizite Freigabe.
- [x] 1.3 Lokale Ownership-Feldänderungen aus `content.updateMetadata` herauslösen und ausschließlich über den Transferpfad autorisieren.
- [x] 1.4 Source-Scope gegen den aktuellen Inhalt prüfen; Ziel-Account oder Ziel-Organisation ausschließlich auf Aktivstatus, Instanz, Typ und Zielvertragsfähigkeit validieren.
- [x] 1.5 Autorisierungs-, Katalog-, Scope- und Privilege-Escalation-Regressionstests ergänzen.

## 2. Ziel-Principal-Auflösung

- [x] 2.1 Einen serverseitigen, paginierten Zielkatalog für aktive Accounts und Organisationen derselben Instanz mit PII-minimiertem Anzeigemodell bereitstellen.
- [x] 2.2 Für Mainserver-Inhalte nur Ziele mit eindeutiger, konfliktfreier, aktueller DataProvider-Bindung und verwendbaren persönlichen beziehungsweise organisatorischen Credentials zulassen.
- [x] 2.3 Ziel-Principal und Binding-Version unmittelbar vor der Mutation unter dem bestehenden DataProvider-Lock erneut prüfen.
- [x] 2.4 Freie DataProvider-, Credential-, Account- oder Organisationswerte außerhalb des typisierten Ziel-Principal-Vertrags im Request-Schema ablehnen.
- [x] 2.5 Tests für gelöschte, gesperrte, instanzfremde, credential-lose, mehrdeutige und konfliktbehaftete Ziele ergänzen.

## 3. Lokaler Content-Transfer

- [x] 3.1 Einen atomaren lokalen Transferbefehl implementieren, der genau einen Owner-Typ setzt und den jeweils anderen Owner entfernt.
- [x] 3.2 Die sichtbare Autorenanzeige lokaler Inhalte unverändert lassen und dies in Repository-, History- und API-Tests absichern.
- [x] 3.3 Nach erfolgreichem Transfer Read-Sicht und Response so behandeln, dass ein erwarteter Zugriffsverlust des Actors den Erfolg nicht widerruft.

## 4. Typisierter Mainserver-Transfer

- [x] 4.1 Im verifizierten Mainserver-Schema-Snapshot die optionalen `dataProviderId`-Argumente für News, Events, POI, Touren und GenericItems bestätigen; die vier vorhandenen Studio-Adapter typsicher anbinden und Touren mangels redaktionellem Studio-Editor capability-gated lassen.
- [x] 4.2 Einen server-only Transferadapter ergänzen, der Quell-Principal und Ziel-Principal trennt und niemals DataProvider-IDs aus dem Browser übernimmt.
- [x] 4.3 Fresh Same-Credential-Pre-Read, Transfer-Permission, Quell-DataProvider, Zielbindung und Typ-Capability vor dem Provider-Write erneut prüfen.
- [x] 4.4 Eine stabile Operationsreferenz im bestehenden Mainserver-Mutationsjournal reservieren und erwarteten Quell- sowie Ziel-DataProvider festhalten.
- [x] 4.5 Nach bestätigtem Transfer Response beziehungsweise Target-Re-Read validieren und Projektion, Credential-Quelle, Liste, History und Audit auf den Ziel-Principal nachziehen.
- [x] 4.6 Bei verlorenem Response zuerst Target-, danach Source-Re-Read ausführen; nur eindeutige Evidenz finalisieren oder wiederholen, sonst `reconciliation_required` setzen.
- [x] 4.7 Sicherstellen, dass lokale Folgefehler einen bestätigten Mainserver-Erfolg nicht als Provider-Fehler oder Rollback darstellen.
- [x] 4.8 Contract- und Integrationstests für Root-/Abhängigkeitsübertragung, ExternalReference-Konsistenz, Retry, Timeout, Konflikt und Reconciliation ergänzen; Root-/Abhängigkeits- und ExternalReference-Transaktion sind in der Mainserver-Baseline `ee619d0e`, Adapter-/Retry-/Reconciliation-Pfade im Studio abgesichert.

## 5. Gemeinsame Oberfläche

- [x] 5.1 Einen gemeinsamen `ContentOwnershipPanel`-Vertrag getrennt von „Bearbeiten als“ implementieren; bei Mainserver-Inhalten den aktuellen Inhaber ausschließlich aus dem frisch gelesenen Content-DataProvider ableiten.
- [x] 5.2 Den Inhaberbereich im Bearbeitungsmodus der vorhandenen Editoren für News, Events, POI, generische Inhalte, FAQ, Cockpit Cards, Featured Projects und Surveys genau einmal am Anfang des ersten fachlichen Tabs integrieren; im Create-Modus nur den getrennten Erstellungsprincipal zeigen.
- [x] 5.3 Die einheitliche Anzeige auch für nicht transferfähige Typen bereitstellen und dort die fehlende Transferunterstützung verständlich kennzeichnen, ohne eine aktive Aktion anzubieten.
- [x] 5.4 Einen dauerhaften Ownership-Hinweis im Inhaberbereich und eine kompakte Wiederholung an der Speichern-Aktion ergänzen: normales Speichern ändert den Inhaber nicht; Transferberechtigung und abweichender Mutationsprincipal werden verständlich erklärt.
- [x] 5.5 Eine gemeinsame shadcn/ui-basierte Aktion „Inhalt übertragen“ mit serverseitig paginierter Zielsuche implementieren; persönliche Accounts und Organisationen klar gruppieren oder filtern und jeden Treffer textlich typisieren.
- [x] 5.6 Aktuellen Inhaber sowie inaktive, gelöschte, konfliktbehaftete und credential-lose Ziele aus der Auswahl ausschließen; keine freie DataProvider-ID und standardmäßig keine E-Mail-Adresse darstellen.
- [x] 5.7 Einen Prüfschritt „Aktueller Inhaber → Neuer Inhaber“ mit Typ, Name, Auswirkung auf die Autorenanzeige, möglichem Zugriffsverlust und expliziter Bestätigung umsetzen.
- [x] 5.8 Die Aktion ausschließlich bei effektiver `content.transferOwnership`-Permission und positiver serverseitiger Typ-Capability aktivieren; V1-Plugins ohne pluginlokale Zielauflösung oder Transferlogik anbinden.
- [x] 5.9 Nach Erfolg zuerst bestätigendes Feedback zeigen, den aktuellen Inhaber neu laden und bei verlorenem Detailzugriff anschließend kontrolliert in die Inhaltsliste navigieren.
- [x] 5.10 Lokalisierte Erfolgs-, Denial-, Binding-, Credential-, Unsupported-, Ownership-Hinweis- und Reconciliation-Meldungen für Deutsch und Englisch ergänzen.
- [x] 5.11 Fokusführung, Tastaturbedienung, Screenreader-Namen, Lade-/Disabled-State und 44×44-Zielgrößen mit Unit-, Axe- und E2E-Tests absichern.
- [x] 5.12 Konformitätstests ergänzen, die je registriertem Content-Editor genau eine Inhaberanzeige im ersten Tab, den Save-Hinweis und die permission-/capability-gesteuerte Transferaktion nachweisen.

## 6. Audit, Observability und Dokumentation

- [x] 6.1 Append-only Audit für Actor, Action, Content-ID/-Typ, Source-/Target-Principal, alte/neue DataProvider-Referenz, Operationsreferenz, Binding-Version, Ergebnis und Reconciliation-Status ergänzen, ohne PII oder Secrets zu speichern; Coverage ausdrücklich als `studio_mutations` kennzeichnen.
- [x] 6.2 Strukturierte Metriken und Logs für Erfolg, Denial, Target-Validierung, Upstream-Rejection, Timeout und `reconciliation_required` ergänzen.
- [x] 6.3 Content-/IAM-Bedienungsdokumentation, Permission-Referenz und Mainserver-Runbook auf Deutsch aktualisieren.
- [x] 6.4 Eine ADR zum kontrollierten Content-Inhabertransfer erstellen und die arc42-Abschnitte 03, 04, 05, 06, 08 und 09 aktualisieren.
- [x] 6.5 Prüfen und dokumentieren, dass keine Studio-Datenbankschemaänderung erforderlich ist; falls die Implementierung doch Schemaänderungen benötigt, `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` im selben Änderungsblock fortschreiben.
- [ ] 6.6 Nutzerverständlichen Studio-Changelog-Eintrag ergänzen.
- [x] 6.7 Dokumentieren und testen, dass der aktuelle Inhaber nie aus Audit oder History rekonstruiert wird und eine optionale Historienanzeige auf potenziell fehlende externe Änderungen hinweist.

## 7. Abnahme und Rollout

- [ ] 7.1 Die Matrix Account→Account, Account→Organisation, Organisation→Account und Organisation→Organisation für jeden V1-Typ mit klar markierten Testdaten in Dev und Staging prüfen.
- [ ] 7.2 Negative Abnahme für fehlende Permission, falschen Scope, instanz-/municipality-fremdes Ziel, stale Binding, fehlende Credentials, unsupported Typ und parallele Mutation durchführen.
- [ ] 7.3 Bestehende Abnahme-Principals ohne Mainserver-Rolle `studio` kontrolliert reprovisionieren und die Rollenwirkung getrennt vom Content-Transfer nachweisen.
- [ ] 7.4 Nach jedem Transfer Mainserver-DataProvider, abhängige Datensätze, ExternalReference, Studio-Projektion, neue Read-Sicht, History und Audit verifizieren.
- [ ] 7.5 Relevante Unit-, Type-, Server-Runtime-, Integration-, Accessibility- und E2E-Gates sowie `pnpm test:pr` vor dem initialen PR-Push ausführen.
- [ ] 7.6 Erforderliche Mainserver-Version und Studio über die jeweils geschützten kanonischen Rolloutpfade ausrollen; Production erst nach positiver Staging-Matrix und expliziter Freigabe promoten.
