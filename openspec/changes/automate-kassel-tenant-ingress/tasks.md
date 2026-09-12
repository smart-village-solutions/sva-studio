## 0. Review- und Abhängigkeitsgrenzen

- [x] 0.1 Revidiertes Proposal, Design, Assurance und Spec-Deltas fachlich
      freigeben
- [ ] 0.2 #1319/#1339 oder einen gleichwertigen Nachfolger als führenden
      SSF-Readiness-Vertrag abschließen
- [ ] 0.3 Cross-Repository-Reihenfolge und zuständige Reviewer für
      `sva-studio` und `smart-speech-flow` festlegen
- [x] 0.4 Den aktuellen Login-500 von `svs` read-only bis zur konkreten
      Fehlerursache korrelieren

## 1. Führenden Elternlauf härten

- [ ] 1.1 Den vorhandenen `iam.instance_provisioning_runs`-Datensatz pro
      Instanz, Operation und Idempotency-Key in place fortschreibbar machen
- [ ] 1.2 Versionierten Sollsnapshot, Kindlauf-Korrelation, Claim/Lease,
      Wake-up, Attempts, Deadline und terminale Evidenz mit minimaler
      Schemaerweiterung modellieren
- [ ] 1.3 Instanz, Elternlauf und ausführbaren Startzustand ohne verlorenes
      Wake-up persistieren
- [ ] 1.4 Instanzgebundene Serialisierung und Idempotenz des vorhandenen
      Keycloak-Provisioners für den Elternlauf wiederverwenden
- [ ] 1.5 Migration, Down-Pfad, Schema-Snapshot und Schemadokumentation
      aktualisieren
- [ ] 1.6 PostgreSQL-Integrationstests für Parallelität, Redelivery, Lease,
      Deadline, Snapshot-Drift und Prozessabbruch ergänzen

## 2. Spezialisierte Readiness anbinden

- [ ] 2.1 Keycloak-Kindläufe explizit mit Elternlauf und Sollsnapshot
      korrelieren, ohne den spezialisierten Queue-Vertrag zu duplizieren
- [ ] 2.2 Nur aktuelle, snapshotkompatible Keycloak-Postflight-Evidenz als
      erfolgreiche Stufe akzeptieren
- [ ] 2.3 Effektiv aktive Module aus dem aktuellen Lifecycle-Vertrag ableiten;
      nicht zugewiesene Module nicht blockierend behandeln
- [ ] 2.4 Für SSF den vollständigen #1319-Readiness-Vertrag referenzieren und
      Directory-Filter nur als letzte fail-closed Sicherung behandeln
- [ ] 2.5 Tests für fehlende, blocked, stale und nach Prozessabbruch
      wiederhergestellte Kindlauf-/Lifecycle-Evidenz ergänzen

## 3. SSF-Traefik-Infrastruktur im Repository `smart-speech-flow`

- [ ] 3.1 Eigenen PR für File Provider und dynamisches
      Konfigurationsverzeichnis erstellen
- [ ] 3.2 Traefik-Verzeichnis read-only mounten und Docker Provider sowie
      bestehende Router unverändert lassen
- [ ] 3.3 Providerqualifizierte Studio-Service-Referenz gegen die reale
      Kasseler Topologie festlegen und testen
- [ ] 3.4 Vertragstests für leeres Verzeichnis, atomare Updates, ungültige
      Dateien und bestehende Hosts ergänzen
- [ ] 3.5 SSF-Änderung vor Aktivierung des Studio-Kassel-Modus reviewen,
      ausrollen und live verifizieren

## 4. Kasseler Provisioner um Ingress erweitern

- [ ] 4.1 Expliziten Kassel-Modus mit bestehendem Verhalten als
      standardmäßigem Default ergänzen
- [ ] 4.2 Writer-Mount ausschließlich dem vorhandenen Standalone-Provisioner
      geben; App und Traefik ohne Schreibrecht sowie ohne zusätzlichen
      Docker-Socket halten
- [ ] 4.3 Hostnormalisierung, reservierte Namen und strikte
      `*.dialog.kassel.de`-Validierung implementieren
- [ ] 4.4 Deterministischen Renderer für genau einen expliziten Router und
      tenantbezogenen Zertifikatsvertrag implementieren
- [ ] 4.5 Validieren, in temporäre Datei schreiben und innerhalb desselben
      Verzeichnisses atomar umbenennen
- [ ] 4.6 Routerübernahme und öffentliches Zertifikat mit begrenztem Retry und
      stabilen Fehlercodes prüfen
- [ ] 4.7 Unit-, Property-, Golden- und Fault-Injection-Tests einschließlich
      Injektions-, Teilwrite-, Reload- und ACME-Fehlern ergänzen

## 5. Terminale Ende-zu-Ende-Orchestrierung

- [ ] 5.1 Registry-, Keycloak-, Lifecycle-, Ingress-, TLS-, Auth-,
      Aktivierungs- und Public-Smoke-Stufen im Elternlauf orchestrieren
- [ ] 5.2 Erfolg ausschließlich nach Studio-Login und den Anforderungen aller
      effektiv aktiven Module terminal speichern
- [ ] 5.3 Recovery für Prozessabbruch insbesondere zwischen Aktivierung und
      öffentlichen Postconditions implementieren
- [ ] 5.4 Terminale Fehler ohne destruktiven Rollback speichern und
      autorisierten Retry ab der ersten nicht nachgewiesenen Stufe ermöglichen
- [ ] 5.5 Integrations- und Fault-Injection-Tests für jede Stufengrenze,
      `svs`-ähnlichen Login-500 und aktive Instanz mit nichtterminalem Lauf
      ergänzen

## 6. Control-Plane-UI und Beobachtbarkeit

- [ ] 6.1 Create-Antwort und UI auf Run-ID sowie reine serverseitige
      Statusbeobachtung ausrichten
- [ ] 6.2 `requested` und `provisioning` als laufenden Vorgang, niemals als
      abgeschlossene Anlage darstellen
- [ ] 6.3 Erfolg ausschließlich für terminal erfolgreichen Elternlauf anzeigen
- [ ] 6.4 Terminalen Fehler mit sicherer Stufe, Fehlercode und Retry-Aktion
      darstellen
- [ ] 6.5 Texte vollständig über i18n und Status-/Fehlerdarstellung
      barrierefrei umsetzen und testen
- [ ] 6.6 Audit, Logs und Metriken auf Eltern-/Kindlauf-Korrelation und
      Secret-Redaction prüfen

## 7. Dokumentation und Architektur

- [ ] 7.1 ADR für Elternlauf-Orchestrierung und Kassel-spezifische
      File-Provider-Integration verfassen
- [ ] 7.2 `docs/operations/ssf-standalone-hosts.md` auf die tatsächlichen
      Bestands- und Zielrouter sowie den terminalen Ablauf aktualisieren
- [ ] 7.3 Control-Plane-Zielbild und betroffene arc42-Abschnitte 03, 04, 05,
      06, 07, 08, 09, 10 und 11 aktualisieren und verlinken
- [ ] 7.4 Queue-Drain, Snapshot-Kompatibilität, Diagnose, Retry, Failure
      Retention und nichtdestruktiven Rollback dokumentieren
- [ ] 7.5 Keinen zweiten kanonischen Studio-Rollout definieren

## 8. Lokale und CI-Gates

- [ ] 8.1 Jeden Implementierungsblock mit den kleinsten betroffenen Unit-,
      Typ-, Migrations- und Integrationstests absichern
- [ ] 8.2 Server-Runtime-Gate für betroffene serverseitige Packages ausführen
- [ ] 8.3 OpenSpec strict, Dateiplatzierung, DB-Schema-Snapshot, Doku-Checks und
      relevante Deployment-Vertragstests ausführen
- [ ] 8.4 Vor dem initialen Code-Push den affected Scope messen und den
      passenden PR-Gate-Pfad ausführen
- [ ] 8.5 Beide Repository-PRs am exakten HEAD auf Checks, Reviews und offene
      Threads prüfen

## 9. Kasseler Enablement und Bestandsmigration

- [ ] 9.1 Bestehende Traefik-/Compose-Konfiguration sichern und verifizierten
      Rückweg festhalten
- [ ] 9.2 SSF File Provider zunächst mit leerem Verzeichnis aktivieren und alle
      Bestands-Hosts prüfen
- [ ] 9.3 Studio-Provisioner und Kassel-Modus kontrolliert aktivieren
- [ ] 9.4 `tenant-havelland` über einen höher priorisierten dynamischen Router
      migrieren, vollständig prüfen und erst danach aus der statischen Regel
      entfernen
- [ ] 9.5 Login-500 von `svs` beheben und denselben Migrationspfad erst nach
      erfolgreicher Readiness ausführen
- [ ] 9.6 Zertifikat, Router, Studio-Login und bei aktivem SSF den vollständigen
      Directory-/Keycloak-/Callback-/Gateway-Pfad extern nachweisen
- [ ] 9.7 Unbekannten Host, fehlgeschlagenen Tenant, fehlende Modul-Readiness,
      Provisioner-Abbruch und Retry live fail-closed prüfen
- [ ] 9.8 Terminalzustand, erhaltene Artefakte, Audit-Evidenz und Rollback
      dokumentieren
