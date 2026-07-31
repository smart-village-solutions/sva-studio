## 1. Auftrags- und Sicherheitsvertrag

- [x] 1.1 Signiertes, versioniertes Schema für `backup-and-verify`-Requests und terminale Ergebnisobjekte definieren; GitHub-OIDC-Claims, Request-ID, Umgebung, Digest, Ablaufzeit und Wartungsfenster-Verweis für Production normativ validieren.
- [x] 1.2 Zentrale Umgebungs-Allowlist implementieren, die Datenbankziel, Bucket, Objektpräfix und Secrets ausschließlich aus `staging` oder `prod` ableitet.
- [x] 1.3 Replay- und globales Parallelitätsverhalten pro Request-ID fail-closed festlegen und testen.
- [x] 1.4 Redaction-Vertrag für Request-, Ereignis- und Ergebnisobjekte testen; Zugangsdaten, URLs mit Credentials, Datenbankinhalte und Shell-Traces ausschließen.

## 2. Zentraler Backup-Agent

- [x] 2.1 Minimales, versioniertes Agent-Image mit `aws`, `pg_dump`, `pg_restore`, Tool-Preflight und Healthcheck erstellen.
- [x] 2.2 Einen einmaligen Swarm-Service mit einer Replica, deterministischem Placement, internen Staging-/Production-Netzen, dem bestehenden Traefik-Netz und getrennten Secrets definieren.
- [x] 2.3 Agent-Ausführung implementieren: Custom-Dump, Upload, Download, Größen-/SHA-256-Vergleich, Archivprüfung und redigierte Schritt-Evidenz.
- [x] 2.4 Dauerhafte Laufzeitevidenz für Image-Digest, Tool-Versionen, Request-ID, Zielumgebung, Schrittstatus und Terminalergebnis nach MinIO schreiben.

## 3. Promote- und Drill-Integration

- [x] 3.1 `Promote` so umstellen, dass er vor mutierenden One-shot-Jobs über den gehärteten HTTPS-Endpoint einen signierten Agent-Auftrag erzeugt, auf das korrespondierende Ergebnis wartet und bei jedem abweichenden oder fehlenden Nachweis fail-closed endet.
- [x] 3.2 Den manuellen Staging-Backup-Drill auf denselben Auftragsvertrag umstellen, ohne Migration, Bootstrap oder App-Deployment auszuführen.
- [x] 3.3 Production-Aufträge an GitHub-Environment-Freigabe, Wartungsfenster und erfolgreiche Staging-Parität binden.
- [x] 3.4 Den bisherigen temporären Backup-Stack bis zur erfolgreichen Abnahme als expliziten Fallback erhalten; seine Entfernung als separaten Folgechange dokumentieren.

## 4. Tests und Betriebsabnahme

- [x] 4.1 Unit-Tests für Signatur, Ablaufzeit, Umgebungsbindung, Replay-Schutz, Objektpfade und Redaction ergänzen.
- [x] 4.2 Lokalen PostgreSQL-/MinIO-End-to-End-Test für Staging und Production-Zielauswahl ergänzen; Cross-Environment-Zugriffe müssen fehlschlagen.
- [x] 4.3 Workflow-Contract-Tests ergänzen: ausschließlicher HTTPS-`POST` auf den gehärteten Endpoint, keine beliebigen Kommandos, Staging vor Production und fail-closed bei fehlendem Ergebnis.
- [x] 4.4 Relevante Unit-, TypeScript-, Server-Runtime-, Workflow-, Security- und File-Placement-Gates ausführen.

## 5. Dokumentation und kontrollierter Rollout

- [x] 5.1 Arc42-Abschnitte 05, 06, 07, 08, 09 und 11 sowie das Swarm-Runbook aktualisieren; eine ADR für die zentrale Vertrauenszone und den gehärteten HTTPS-Kontrollkanal erstellen.
- [x] 5.2 Staging-Agent bereitstellen, Health-/Tool-Vertrag sowie einen erfolgreichen Backup-Drill mit Dump, Prüfsumme und Evidenz in MinIO nachweisen.
- [x] 5.3 Nach expliziter Production-Freigabe den Production-Agentenpfad mit demselben Nachweis abnehmen.
- [x] 5.4 Erst nach 5.2 und 5.3 Task 4.3 von `add-promote-backup-production-parity` schließen.
