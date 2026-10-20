## 1. Reader und sichere Diagnose

- [x] 1.1 Vorhandene Reader, Organisationszustände, Accountzuordnung, Verschlüsselung, Binding-Fingerprints und POST-Refresh gegen aktuellen Quellstand prüfen; bestehende Readiness-/Rollout-Nachweise nicht als erledigt übernehmen.
- [x] 1.2 Sichere Ursachen im bestehenden Diagnosevertrag unterscheiden: tatsächliches Fehlen/Partialität, Abhängigkeitsausfall, ungeklärter Organisationszustand, Account-/Binding-Konflikt und Entschlüsselungsfehler. Kompatible öffentliche Fehlercodes und erlaubte Zusatzdetails festlegen.
- [x] 1.3 Persönliche Attribute einmal frisch aus dem instanzgebundenen Keycloak lesen; bei weiter fehlenden/partiellen Attributen oder Ausfall ohne Write beenden. Testen, dass ein erneuter Read keine erfundenen Cacheannahmen oder Provisionierung benötigt.

## 2. Lokale Organisationsrücksicherung

- [x] 2.1 Vor Repository-Schreibänderungen `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` prüfen. Bestehenden Credential-Write-/Lease-/Binding-Pfad erweitern, ohne Migration, neuen Speicher oder generische Recovery-Schicht.
- [x] 2.2 Zulässigkeit gemäß Design prüfen: bestehende Zeile im Zustand `ready` mit bisherigem Verifikationszeitpunkt, tatsächlicher lokaler Verlust, eindeutiger aktiver Account und Keycloak-Marker, vollständige kanonische Kandidaten und passende noch vorhandene DB-Bestandteile.
- [x] 2.3 Kandidatenfingerprint im Organisationskontext bestimmen und genau eine aktuelle verifizierte Zuordnung ohne konkurrierende Version/Providerkonflikt verlangen; historische, widerrufene oder ungeklärte Bindings und abweichende vollständige DB-Credentials unverändert lassen.
- [x] 2.4 Rücksicherung unter bestehenden Sperren/Lease mit erneuter Zustandsprüfung atomar verschlüsselt schreiben und sicher auditieren. Frühere Verifikation erhalten, kein frisches externes Verifikationsdatum vortäuschen. Vorhandene Helper vor destruktivem Statusreset prüfen/anpassen; danach kanonischer Read-back.
- [x] 2.5 Gezielte Integritätstests für falsche Zuordnung/Marker, falschen Fingerprint, Legacy-Kopie, historische Version, vollständige Abweichung, manuelle Änderung, fehlende Zeile, Schlüssel-/Entschlüsselungsfehler und nicht freigegebene Zustände ergänzen.
- [x] 2.6 DB-Integrationstests für parallele Läufe, aktive/abgelaufene Lease, veralteten Kandidaten, Accountlöschung und Abbruch vor/nach Commit ergänzen; keine Teilwrites und keine neue Bindung/Ownership nachweisen.

## 3. Stiller Ablauf und Supportmeldung

- [x] 3.1 Im bestehenden authentifizierten POST-Refresh Instanz-/Account-/Organisationskontext und Read-Berechtigung erneut prüfen; interne Reparatur nur derselben bekannten Version zulassen, keine frei wählbaren Zielcredentials und kein zusätzliches Verwaltungsrecht zum Setzen neuer Werte ableiten.
- [x] 3.2 Nach passendem Fehler einmal stillen Refresh aus der Oberfläche auslösen, laufende Arbeit wiederverwenden und nach Wiederherstellung höchstens einen Inhaltsabruf wiederholen. Kontextwechsel, Logout, Rechteentzug, mehrere Tabs, Polling und Prozessneustart mit bestehendem persistentem Sync-State/Cooldown absichern; keine erneute automatische Vorziehung nach Fehler.
- [x] 3.3 Nicht mögliche Recovery, Read-back-Fehler und verbleibenden Inhaltsfehler präzise anzeigen. Vorhandene/fehlende Snapshots und teilweise verfügbare Inhaltstypen korrekt darstellen; Kopiertext für `support@smart-village.solutions` mit Instanz, Funktion, Zeit/Zeitzone, Codes, ursprünglicher und korrelierter Request-ID sowie Recovery-Ergebnis/Phase anbieten.
- [x] 3.4 de/en, zugänglichen Aktualisierungs-/Fehlerstatus, Clipboard-Erfolg und selektierbaren Fallback prüfen. Keine automatische Mail, kein Upload und keine sensiblen Daten im Supportblock oder in Logs.
- [x] 3.5 Auth-/UI-/API-Tests für zulässige Redakteure, fremde Scopes, fehlende Rechte, Einmaligkeit und getrennten Credential-/Inhaltserfolg ergänzen. Ausschluss von Keycloak-Writes, Accountanlage, `user_provisionings`-POST, Rotation und GET-/Login-/Scheduler-Recovery nachweisen.

## 4. Dokumentation und Abnahme

- [x] 4.1 arc42 04/05/06/08 prüfen und betroffene Autorisierungs-, Laufzeit- und Fehlerverträge aktualisieren; vorhandene IAM-/Mainserver-Betriebsdokumentation ergänzen. ADR-Regel für neue IAM-Patterns berücksichtigen; keinen parallelen Deploy-/Recovery-Betriebspfad einführen.
- [x] 4.2 Kleinste echte Unit-/Type-Gates und spezielle Auth-/Datenintegritätsgates gemäß tatsächlichem Diff ausführen; bei serverseitigen Runtime-Änderungen früh `pnpm check:server-runtime`. Kritische Invarianten vor Implementierung fachlich reviewen.
- [x] 4.3 OpenSpec strikt validieren, Formatierung, Dateiplatzierung und Diff prüfen. Ein Schemawechsel ist nicht geplant; wäre er notwendig, Scope vor Umsetzung neu prüfen und Schemaunterlagen aktualisieren.
- [ ] 4.4 Nach gesondert freigegebenen Tests den persönlichen Wiederabruf, erfolgreiche/abgewiesene Organisationsrücksicherung und Supportfall live abnehmen. Inhaltsaktualisierung und anschließendes Lesen desselben Scopes sowie Datenstand belegen; Zeitfenster secretfrei dokumentieren. Weniger Warnungen sind kein Behebungsnachweis.

## Lokaler Nachweisstand vom 20.10.2026

Die Umsetzung liegt ausschließlich im separaten Worktree `mainserver-credential-recovery`; kein Push, Rollout oder Live-Write wurde ausgeführt. Die sicherheitsrelevanten Invarianten wurden anhand der vorhandenen Security-, Testqualitäts- und Content-Reviewregeln selbst geprüft; es gab kein unabhängiges Agentenreview.

Gezielte Auth-, API-, Hook- und Routentests einschließlich realer PostgreSQL-Transaktionen prüfen den bekannten Versionsnachweis, parallele Rücksicherung, konkurrierende manuelle Änderungen, Accountlöschung/Mitgliedschaftsentzug vor Commit, aktive/abgelaufene Lease, Audit-Rollback sowie den atomaren persistenten Versuch über mehrere Verbindungen. Abbrüche werden durch fehlgeschlagenen Transaktionsabschluss und anschließenden Read-back geprüft; ein Betriebssystem-Prozessabbruch wurde nicht injiziert. Clipboard-Fallback und Übersetzungen sind komponentenbasiert geprüft; eine manuelle Browser-/Screenreader-Abnahme steht mit der Live-Abnahme aus.

Weitere Gates: Auth-/App-Typechecks, Server-Runtime, i18n, gezieltes ESLint, Dokumentation, IAM-OpenAPI, Dateiplatzierung, OpenSpec strict und `git diff --check`. Die vollständige CI und die produktive Wirksamkeit sind damit nicht nachgewiesen. Punkt 4.4 bleibt ausdrücklich offen.

Nach dem Merge von PR #1931 wird der Fortsetzungsvertrag separat abgesichert: Die ursprüngliche Browser-Anfrage wird nach dem Keycloak-Read und vor dem Inhalts-Retry erneut authentifiziert; Session, Subject, Instanz und aktive Organisation müssen übereinstimmen. Der bestehende Inhaltsautorisierer muss weiterhin erlauben. Die zuvor gelesene Permission-Revision wird in der gesperrten Credential-Transaktion vor dem Write verglichen. Gezielte Tests decken Logout/Kontextwechsel, Rechteentzug, fehlende Nachweise sowie Änderungen der Benutzer-/Instanzrevision und nicht lesbare Revisionen ab.

Der Revisionsvergleich wird mit den bestehenden Revisions-UPSERTs serialisiert: Instanz- und Benutzerzeile werden (gegebenenfalls mit dem bisherigen Default `1` materialisiert) bis zum Credential-Commit per `FOR SHARE` gehalten. Acht Mehrverbindungstests prüfen beide Commit-Reihenfolgen für beide Revisionsarten mit vorhandenen und fehlenden Zeilen; die geänderte Revision verhindert den Write oder der spätere Rechteentzug wartet. Die normalen Permission-Reads bleiben unverändert ungesperrt.
