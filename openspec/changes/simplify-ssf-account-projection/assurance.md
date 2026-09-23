# System-Assurance: Synchrone SSF-Account-Anlage

## Kritische Invarianten

| ID | Invariante | Führender Nachweis |
| --- | --- | --- |
| `SSF-ACCOUNT-01` | Erfolg bedeutet vollständigen Keycloak-Write und lokalen Commit von Account, Mitgliedschaft und Zuweisungen; kein nachgelagerter SSF-Abschluss. | Orchestrierungs-Unit-Test und Keycloak-Integration |
| `SSF-ACCOUNT-02` | Ohne bestätigte aktuelle Mandantenbasis oder zulässige Zuweisungen erfolgt keine externe oder lokale Benutzeranlage. | Precondition- und Versionswechseltests |
| `SSF-ACCOUNT-03` | Claims stammen aus kanonischen effektiven Rollen einschließlich Gruppenrollen; fachlicher Status und Tenant-Grenze bleiben erhalten. | Ableitungstests mit manipuliertem Request, Gruppenrollen und zwei Tenants |
| `SSF-ACCOUNT-04` | Fehler vor erfolgreichem Commit kompensieren ausschließlich die bekannte externe Neuanlage; fehlgeschlagene Bereinigung ist sichtbar. Nach Commit erfolgt keine Delete-Kompensation. | Rollenabgleich-/Transaktions-/Delete-Fehler und Folgefehler nach Commit |
| `SSF-ACCOUNT-05` | Vertragsrevision ist subject-unabhängig; gleiche Revision ersetzt weder Inhaltsvergleich noch Generation und Read-back. | Gleiche Revision mit geänderten Rechten und abweichendem Read-back |
| `SSF-ACCOUNT-06` | Ein aktiver berechtigter Account ist nach Commit im Directory berücksichtigt und erhält alle vier Claims im realen Token. | Erster Account bei leerer Projektionsliste, Keycloak-Token-E2E |
| `SSF-ACCOUNT-07` | Create und Reconcile einschließlich Source-Snapshot verwenden dieselbe Tenant-Sperre; spätere Rechteänderungen und Recovery bleiben wirksam. | Gezielter Parallelitätstest und vorhandene Lifecycle-Tests |
| `SSF-ACCOUNT-08` | Die Umfangsgrenze aus dem Design gilt; alte Vertragsstände bleiben bis zur Konvergenz gesperrt. | Architektur-Diff, Versionswechsel und Rollback |

## Failure Modes

- Fehlende Basis, unzulässige Rolle/Gruppe oder Sperrkonflikt: unmittelbar
  sichtbarer Fehler vor Benutzeranlage; kein Reparatur- oder Abschlussjob.
- Bekannter Fehler bei Rollenabgleich oder lokaler Transaktion: ausschließlich
  die in diesem Request erzeugte Keycloak-ID über denselben Provider löschen.
- Delete-Fehler oder unklarer externer Create-Ausgang: sicherer sichtbarer
  Betriebsfehler mit Korrelations-ID; keine Erfolgsmeldung und keine Löschung
  fremder Benutzer. Eine externe Restanlage kann operative Bereinigung erfordern.
- Fehler nach lokalem Commit: bestehende Folgepfad-Semantik, keine Löschung
  des erfolgreich angelegten Accounts.
- Alter Vertragsstand: Readiness-Leser sperrt bereits vor erstem Reconcile;
  der bestehende Vertragsdrift-Scheduler übernimmt die einmalige Konvergenz.

## Nachweise vor Freigabe

Gezielte Unit-/Integrationstests decken die Fehler- und Parallelitätspfade ab.
Staging weist am exakten Image-Digest normale und technische Rollen, den ersten
berechtigten Account im Directory sowie Anlage → Token → SSF-Login → Gespräch
nach. Die einmalige Vertragskonvergenz und der Rollback werden vor Freigabe
geprüft. Vorhandene Nachweise für Mapper-Drift und Recovery werden wiederverwendet
und nur bei konkreten Abdeckungslücken ergänzt.
