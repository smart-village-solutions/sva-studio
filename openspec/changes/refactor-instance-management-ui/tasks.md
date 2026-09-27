## 1. Liste und Anlage im vorhandenen Pfad überarbeiten

- [x] 1.1 Bestehende Create-/Detail-Tests und HTTP-Payloads als gezielte Regression-Baseline prüfen; wirksame Readiness-/Plan-/Aktivierungsverträge mit den im Proposal benannten Changes abgleichen.
- [x] 1.2 Instanzliste mit identifizierbarem Namenslink, bestehenden Filtern, ergänzender Parent-Domain, Lifecycle und belegtem Handlungsbedarf ordnen; Suspendieren/Archivieren in das vorhandene Menü-Pattern verlagern; Gesamt-Audit einmalig auf Anforderung darstellen, ohne N+1-Requests.
- [x] 1.3 Den vorhandenen Create-Formularowner auf den geltenden RHF-/Zod-/Studio-Form-Standard bringen und die Realm-Modus-Entscheidung im zweiten Schritt bündeln; Pflichtfelder, Defaults, abgeleitete Werte und HTTP-Payload unverändert halten.
- [x] 1.4 Review um alle Admin-Angaben, gruppierte `Ändern`-Links und direkte validierte Rückkehr ergänzen; Entwurfsänderung, konkurrierende Readiness-Antworten und Vollvalidierung vor Create absichern.
- [x] 1.5 Drei Blockergruppen gemäß Design gewichten, konkrete Handlungen offen und technische Belege aufklappbar darstellen; Abschnitt sofort mit gezielten Create-/List-Komponenten- und HTTP-Tests prüfen.

## 2. Detailkopf, Einrichtung und Doctor ersetzen

- [x] 2.1 Detailkopf und bestehende Tabs gemäß Zustandsübersicht in `design.md` ordnen; doppelte Identitäts-/Statuskarten sowie die Sammel-Disclosure entfernen; aktive, suspendierte und archivierte Instanzen im Bestand halten.
- [x] 2.2 Fünferfolge kompakt darstellen und aktuellen Schritt mit Ergebnis, Auswirkung, tatsächlichem Plan und genau einer vorhandenen Hauptaktion führen; erfolgreiche Keycloak-Teilschritte bei lokalem IAM-Fehler erhalten. Dies konkretisiert Readiness-Task 7.16.
- [x] 2.3 Fehlermeldungen im bestehenden zuständigen Pfad zusammenführen: Ursache/Unklarheit, Auswirkung, Folgehandlung und sichere Belege; `normalizeKeycloakWorkflowError` für Detail-Laden, Preflight und Planung so korrigieren, dass vorhandene strukturierte Fehler erhalten bleiben. Mit `IamHttpError`, vorhandener Übersetzung und Diagnosedetails unbekannte Codes sicher darstellen; HTTP-nahe Hook-Tests für Datenbankfehler und unbekannten Code ergänzen. Gemischte Befunde nicht über Achsen/Serviceidentitäten hinweg verflachen; Fehlerlinks und persistente Blocker absichern. Dies konkretisiert Readiness-Task 7.16.
- [x] 2.4 Diagnose-/Reparaturmaßnahmen im Doctor an den vorhandenen Detail-Aktionshandler anbinden; bei `instance.status.activate` ausschließlich zum bestehenden Aktivierungsabschnitt navigieren und dessen Überschrift fokussieren. Im Detailtest Mutation erst nach dortiger geschützter Bestätigung nachweisen; doppelte primäre Aktionsflächen vermeiden; Maßnahmenergebnis und aktuelle Folgeprüfung vor Audit/Historie darstellen, ohne neue automatische Probes.
- [x] 2.5 Veralteter Plan, fehlende nächste Aktion, unsicherer Retry, Mutation nur angenommen, fehlerhafter Refresh und aktiver Tenant mit Störung durch gezielte Komponenten-/HTTP-Tests absichern; ersetzte Renderblöcke im selben Abschnitt löschen.

## 3. Module pro Instanz zusammenführen

- [x] 3.1 Vorhandenen `InstanceModulesWorkspace` um die Zusammenführung von Zuweisung, effektiver Aktivierung, Policy und vorhandener Readiness erweitern; Modul-/Plugin-Bezug ausschließlich aus bestehenden Verträgen ableiten.
- [x] 3.2 Technische Checks, Rollen, Permissions, Herkunft, Override und Job-/Reparaturaktionen in Zeilendetails verlagern; aktive/verfügbare Module gruppieren oder gleichwertig filterbar halten; separate Detail-Transparenz- und Readiness-Flächen entfernen.
- [x] 3.3 Unmittelbare Zuweisung/Seeding, Bestätigung beim Entzug samt Folgenvorschau und bestehende Policy-/Berechtigungs-/Job-Sperren erhalten; `/admin/modules` einschließlich dortigem Bootstrap-Einstieg regressionsprüfen.
- [x] 3.4 Tests für zugewiesen+pending, required+fehlende Readiness, nicht verfügbares Plugin, Modul ohne Lifecycle, leeren Modulsatz und doppelte Aktionsauslösung ergänzen; Abschnitt gezielt grün prüfen.

## 4. Einstellungen und Vorlage sauber speichern

- [x] 4.1 Bestehenden Settings-Formularowner auf RHF/Zod und Studio-Form-Primitiven abbilden; Fachgruppen, Disclosures, Fehlernavigation und unveränderte Secret-/Payload-Regeln umsetzen.
- [x] 4.2 Vorlagen-Save/Reset aus dem gespeicherten Instanzsnapshot und der bestehenden Vorlagenrevision aufbauen; fremde lokale Draft-Felder ausschließen, parallele Saves verhindern und `conflict` bis zum Editor erhalten.
- [x] 4.3 Nach Vorlagen-Save nur Vorlagenquelle/-revision aktualisieren, Einstellungsentwurf und Dirty-State erhalten; Öffnen, Wechseln und Schließen mutieren keine Daten; neuen Secret-Wert erst nach erfolgreichem Instanz-Save löschen.
- [x] 4.4 Den vorhandenen Vorlagen-Editor bei geänderter Formularorchestrierung ebenfalls mit vorhandenen Form-Primitiven betreiben; Instanz- und Servervorlagen-Verbraucher ohne neuen Endpoint oder globale Form-Abstraktion absichern.
- [x] 4.5 HTTP-nahe MSW-Nachweise über den tatsächlichen Hook-/API-Pfad für Vorlage neben dirty Name/Realm/Secret, Reset, Vorlagenrevision-Konflikt, Save-Fehler und Tab-/Refresh-Erhalt ergänzen; tatsächlichen Request-Payload und Konfliktweitergabe prüfen, nicht ausschließlich gemockte Save-Callbacks. Lokalen Entwurferhalt bei Fehler/Reauth ohne vollständigen Seitenwechsel absichern; bestehende Anmeldeweiterleitung ohne neue Entwurfspersistenz erhalten. Betroffene Formulare gezielt prüfen.

## 5. Nachweise und Dokumentation abschließen

- [x] 5.1 Alle neuen Labels, Hilfen, Status- und Fehlertexte in de/en prüfen; vorhandene Design-Tokens/Primitiven, Tastaturbedienung, Dialogfokus und Error-Summary-Feldverknüpfung absichern.
- [x] 5.2 Bestehende Playwright-Specs `account-admin-ui.instance-create.spec.ts` und `account-admin-ui.instance-control.spec.ts` um die im Design benannten Szenarien erweitern, einschließlich Mischzustand, sicherer Fortsetzung, schmalem Viewport und Zoom. Dies liefert zugleich die UI-Evidenz für Readiness-Task 7.17.
- [x] 5.3 Gezielte Nx-Dateitests mit `--testFiles=...` über die passenden vorhandenen `test:unit:routes`-/`test:unit:hooks`-/`test:unit:ui`-Targets und App-Typecheck ausführen; tatsächlich ausgeführte relevante Testfälle bestätigen, ein Lauf ohne gefundene Tests zählt nicht als Nachweis. Zusätzlich passende vorhandene Ziele `check:account-ui-foundation`, `check:i18n`, `test:a11y`, `test:e2e` und Lint in ihrem kleinsten aussagekräftigen Scope prüfen. Konfiguration vor dem Aufruf über `pnpm nx show project sva-studio-react --json` verifizieren; keine neue Test-/Gate-Infrastruktur.
- [x] 5.4 `docs/reference/instance-lifecycle-navigation.md`, `docs/development/studio-form-migrationsinventur.md` und arc42 05/08 auf die umgesetzte UI aktualisieren; arc42 04/06 auf Widersprüche prüfen und etwaige begründete Nichtänderung dokumentieren.
- [x] 5.5 Zielort-Matrix aus `design.md` gegen Code und Tests abgleichen: entfernte Karten/Renderwege, erhaltene Aktionen, gemeinsame Modul-/Vorlagen-Verbraucher und neu hinzugefügte Dateien/Konzepte; unnötige Parallelpfade entfernen.
- [x] 5.6 Readiness-Tasks 7.16/7.17 erst mit konkreten gemeinsamen Nachweisen aktualisieren; deren Backend-/Rollout- sowie reale Einladungsabnahmen nicht durch UI-Testresultate als erledigt markieren.
- [x] 5.7 `pnpm exec openspec validate refactor-instance-management-ui --strict`, Formatprüfung, `pnpm check:file-placement` und `git diff --check` ausführen; vor Archivierung einschlägige aktive Deltas gegen die dann aktuelle Basisspec abgleichen.

## Implementierungsnachweis

Umgesetzt im separaten Worktree `implement-instance-management-ui`, Branch
`refactor/instance-management-ui`, aus `origin/main` bei `1185db118`.
Der ursprüngliche Proposal-Worktree bleibt unverändert.

- Bestehende Verträge für Draft-Readiness, Plan-Fingerprint, Serveraktion,
  manuelle Aktivierung, Serviceidentitäten und Vorlagenrevision übernommen.
  Keine API-, Schema-, Server-, Auth- oder Rollout-Änderung.
- Gezielte Routenläufe: 60 Fälle für Detail, lokale Modelle, Modulverwaltung,
  Instanz-/Servervorlage; ergänzend 44 Create-/Detailfälle und 26
  Section-/Create-/Modellfälle. Die Zahlen überlappen und werden nicht addiert.
- Hook-/HTTP-Lauf: 34 Fälle in `use-instances.test.tsx` und
  `use-plugin-tenant-readiness.test.tsx`, einschließlich strukturierter
  Datenbankfehler, unbekannter Codes und fehlgeschlagenem Refresh.
- Accessibility: drei Axe-Fälle für Modulbereitschaft, Vorlagenfehler und
  gemischte Einrichtung. Kontrastprüfung ist im vorhandenen isolierten
  Happy-DOM-Gate deaktiviert; dieses Gate ersetzt keine visuelle Vollabnahme.
- Typecheck, i18n, Account-UI-Foundation und gezielter Lint bestanden.
  Lint enthält 16 Warnungen in Test-Fixtures, keine Fehler.
- arc42 04/06 geprüft: Strategie, Trust Boundaries und serverseitige
  Laufzeitabläufe bleiben unverändert; kein Widerspruch zum UI-Umbau,
  deshalb dort keine Änderung. arc42 05/08, Navigationsreferenz,
  Formularinventur und Nutzer-Dossier wurden aktualisiert.
- Zielort-Matrix: kompakter Header/Cockpit, Module im gemeinsamen Workspace,
  Diagnose/Audit/Historie im Doctor, Formular/Vorlage in Einstellungen.
  Die ungenutzten parallelen Renderdateien `-instance-detail-sections.tsx`,
  `-instance-detail-operations-section.tsx` und
  `-instance-detail-modules-section.tsx` wurden entfernt. Deren aktive
  Nutzeraktionen bleiben über Detail-Handler, Doctor und Modulworkspace
  erreichbar; Tests prüfen diese tatsächlichen Verbraucher.
- Keine neuen Produktionsdateien, Packages, Dienste, Endpoints, Workflows,
  globale Form-Abstraktionen oder Test-Infrastruktur. Neue Dateien sind nur
  die aus dem Proposal-Worktree übernommenen OpenSpec-Unterlagen.

- Abschließender Detaillauf: 34 Fälle, einschließlich stale-plan HTTP 409 mit
  tatsächlichem Fingerprint-Payload, erhaltenem Fehler und neuer Vorschau statt
  erneuter Ausführung. Der redundante Detail-Reload nach fehlgeschlagenem Execute
  ist entfernt; erfolgreiche Mutationen laden bereits im zuständigen Hook nach.
- Playwright: beide bestehenden Instanz-Specs gemeinsam grün, sechs
  Browserszenarien plus Auth-Setup (7/7). Geprüft sind neue/bestehende Realms,
  Anlageblocker, vollständiger Admin-Review mit direkter Korrekturrückkehr,
  Doctor mit getrennten Servicebefunden, Fehlerlink/Feldfokus, Dialogfokus,
  unabhängiger Vorlagen-Payload, Keycloak-Erfolg bei lokalem IAM-Fehler,
  sicherer Retry und aktive gestörte Bestandsinstanzen. Reflow bei 320 Pixeln
  und bei 200% CSS-Layout-Zoom ist geprüft; kein nativer Browser-Zoom-Nachweis.
- Die Browser- und MSW-Tests verwenden kontrollierte HTTP-Fixtures. Sie ersetzen
  keine reale Keycloak-/Einladungsabnahme und keinen Dev-/Staging-/Production-Rollout.
  Nur Readiness-Tasks 7.16/7.17 erhalten diese gemeinsame UI-Evidenz;
  insbesondere 10.5/10.6 bleiben offen.
- OpenSpec-Strict-Validierung, Prettier-Check, Dateiplatzierung und
  `git diff --check` bestanden. Keine Archivierung in diesem Auftrag;
  der Delta-Abgleich gegen die dann aktuelle Basisspec bleibt Voraussetzung
  einer späteren Archivierung.

- PR-Abschluss: Rebase auf `main`, Komplexitäts-Gate ohne neue Findings und
  38 gezielte Fälle für Anlage, Feldhilfen, Modelle und Module bestanden.
  Spezialisierte Admin-Client-Reparatur und Tenant-Admin-Reset bleiben über
  dieselben Detail-Handler in Cockpit und Doctor erreichbar; der aktuelle
  Plan-Fingerprint ist Voraussetzung. Das temporäre Passwort bleibt nach
  fehlgeschlagener Ausführung erhalten und wird erst nach Erfolg geleert.
  Drei zusätzliche Detailfälle prüfen diese Regression einschließlich
  bestehender aktiver Instanzen ohne Login-Secret.
