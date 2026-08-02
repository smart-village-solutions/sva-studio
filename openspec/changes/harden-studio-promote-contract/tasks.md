## 1. Config-Vertrag, Fehlercodes und Shadow-Modus

- [x] 1.1 Getrackte nicht-sensitive Remote-Profile für Dev, Staging und Production sowie eine typsichere Schlüsselklassifikation anlegen.
- [x] 1.2 Deterministischen Builder für Remote-Profil und kompaktes geschütztes Override-Bundle implementieren; `*.local.vars` technisch ablehnen.
- [x] 1.3 Pflichtwerte, Duplikate, unbekannte Schlüssel, Platzhalter, Werttypen und Secret-Wert-/Referenzsemantik validieren.
- [x] 1.4 Gemeinsamen strukturierten Ergebnis- und Fehlercodevertrag mit Phase, Code, Retryklassifikation und `nextAction` implementieren.
- [x] 1.5 Redigierte Äquivalenzprüfung zwischen bestehendem Renderpfad und neuem Builder ergänzen, ohne Secret-Werte, Hashes oder Längen zu verarbeiten.
- [x] 1.6 Builder zunächst ausschließlich im Shadow-Modus ausführen; Environment-Secrets und Deploy-Ausgabe bleiben unverändert.
- [x] 1.7 Unit- und Workflow-Vertragstests für Merge, Klassifikation, Redaction, Fehlercodes und Shadow-Abweichungen ergänzen.

## 2. Candidate-Preflight und Promote-Modi

- [ ] 2.1 Statischen Preflight nach Image-/Git-Validierung und vor der ersten Remote-Mutation integrieren.
- [ ] 2.2 Isolierten read-only Candidate-One-shot mit minimalen Berechtigungen und terminalem Cleanup implementieren.
- [ ] 2.3 Candidate-Prüfungen für Runtime-Profil, externe Secret-Referenzen, Registry-Lesbarkeit, Release-Tenant-Scope und Entschlüsselbarkeit aktiver Tenant-Secrets ergänzen.
- [x] 2.4 `promote_mode=standard|recovery` mit `standard` als Default ergänzen.
- [ ] 2.5 Recovery nur mit nicht leerem Grund, erneuter Environment-Freigabe, vorherigem Live-Digest und unveränderten Backup-, Paritäts- und Post-Deploy-Gates zulassen.
- [ ] 2.6 Tests für unvollständige Config, verbotene lokale Quelle, falschen Schlüsselbund, fehlende Secret-Referenz, unzulässige Candidate-Mutation und Recovery ohne Grund ergänzen.

## 3. Digest-Parität und Backup-Agent-Kompatibilität

- [x] 3.1 Production-Paritätsgate bei jedem Wechsel des Live-Digests ausführen, unabhängig von Migration- und Bootstrap-Modi.
- [x] 3.2 Exakt denselben erfolgreichen Staging-Image-Digest verlangen; Git-Grenzen weiterhin separat über den Imagevertrag prüfen.
- [ ] 3.3 Konvergenz-Retries mit bereits live laufendem Zieldigest anhand strukturierter Fehlercodes und dokumentierter Ursache klassifizieren.
- [x] 3.4 Geschützten read-only Backup-Capability-Endpoint für Protokollversion, Agent-Revision, Datenbankziele, Ergebnisfelder und Waste-Inventar-Unterstützung implementieren.
- [ ] 3.5 Capability-Prüfung vor dem ersten Backup-Auftrag integrieren und Producer-vor-Consumer-Aktivierung erzwingen.
- [x] 3.6 Tests für App-only-Promotion, fehlende oder falsche Staging-Evidenz, kompatiblen und inkompatiblen Agenten sowie unbekannte Protokollversion ergänzen.

## 4. Swarm-Konvergenz und externer Smoke

- [ ] 4.1 Nach dem Deploy auf erfolgreichen terminalen Swarm-Service- und Task-Zustand warten.
- [ ] 4.2 Erst danach externes HTTP-Warmup für Root-, Health-, IAM- und Tenant-Probes starten.
- [x] 4.3 Ausschließlich 404, 502, 503, 504, Timeout und Gateway als retryfähige Infrastrukturzustände klassifizieren.
- [x] 4.4 Realm-, Callback-, Tenant-Scope-, Secret-, Digest- und Unknown-Host-Fehler sofort blockierend halten.
- [x] 4.5 Production-Readiness am Ende ausschließlich mit HTTP 200 bestehen lassen.
- [x] 4.6 Retryversuche aggregiert loggen und terminale Fehler mit stabilen Codes und konkreter nächster Aktion ausgeben.
- [ ] 4.7 Tests für vollständige Router-Lücke mit späterem Erfolg, dauerhaften 404, Swarm-Timeout, Readiness 503, falsches Realm, falschen Callback und offenen Unknown Host ergänzen.

## 5. Evidenz und minimaler Recovery-Vertrag

- [ ] 5.1 Redigierte Evidenz für vorherigen und neuen Digest, Git-Grenzen, nicht-sensitive Config-Revision, externe Secret-Referenzen, Agent-Vertrag und Gate-Ergebnisse ergänzen.
- [ ] 5.2 GitHub-Annotation, Step-Summary und JSON-Artefakt auf denselben Fehlercodevertrag ausrichten.
- [ ] 5.3 Secret-Werte, Hashes, Wertlängen, Environment-Dumps, unredigierte Remote-Logs und PII durch Tests aus allen Evidenzpfaden ausschließen.
- [ ] 5.4 App-Rollback-Vertrag auf vorherigen Digest plus versionierte nicht-sensitive Config-Revision begrenzen; inkompatible Secret-Rotation als separaten Planungsfall dokumentieren.
- [ ] 5.5 Unbekannte interne Fehler redigiert als `PROMOTE_INTERNAL_ERROR` erfassen.

## 6. Gestufte Aktivierung

- [ ] 6.1 Shadow-Äquivalenz für Dev und Staging ohne Remote-Konfigurationsmutation nachweisen.
- [ ] 6.2 Dev autoritativ auf den neuen Builder umstellen und vollständigen Promote mit neuen Evidenzen verifizieren.
- [ ] 6.3 Staging-Builder, Candidate-One-shot, Agent-Capability-Gate und Konvergenz blockierend aktivieren und erfolgreich promoten.
- [ ] 6.4 Production-Shadow-Ergebnis prüfen und Abweichungen vor jeder autoritativen Umschaltung beheben.
- [ ] 6.5 Production erst nach erfolgreichem Dev-/Staging-Nachweis über das geschützte Environment aktivieren.
- [ ] 6.6 Production unabhängig auf Root, `health/live`, `health/ready`, Release-Tenant-Realm, Callback-Host, Unknown-Host-Fail-closed und Live-Digest prüfen.

## 7. Dokumentation und Abschluss

- [x] 7.1 Kanonischen Rollout-Leitfaden um Builder, Shadow-Modus, Candidate-Preflight, Promote-Modi, Agent-Capabilities, Konvergenz und Fehlercodes ergänzen.
- [ ] 7.2 Runtime-Profil- und Swarm-Runbooks so aktualisieren, dass lokale Override-Dateien keine Remote-Quelle sind und keine konkurrierenden Deploypfade entstehen.
- [x] 7.3 Arc42-Abschnitte 06, 07, 08, 10 und 11 um Config-Grenze, Preflight, Observability, Konvergenz und Recovery fortschreiben.
- [x] 7.4 Rollout-Operator und Review-Governance um Shadow-Nachweis, strukturierte Fehlercodes und Producer-vor-Consumer-Regel ergänzen.
- [x] 7.5 Redigierten Learning-Report unter `docs/reports/` mit Ursachen, Auswirkungen, Recovery und Prävention erstellen.
- [ ] 7.6 Kleinste relevante Unit-, Type-, Workflow-, File-Placement- und Server-Runtime-Gates nach jedem Block ausführen.
- [ ] 7.7 OpenSpec strikt validieren und Tasks erst nach tatsächlichem Stufen- und Live-Nachweis abschließen.
