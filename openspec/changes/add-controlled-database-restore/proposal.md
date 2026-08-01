# Change: Kontrollierten Datenbank-Vollrestore über den Backup-Agenten ergänzen

## Warum

Der zentrale Backup-Agent erzeugt verifizierte PostgreSQL-Custom-Dumps, kann diese aber nicht kontrolliert wiederherstellen. Ein Produktionsincident hat gezeigt, dass der verfügbare Quantum-CLI-Zugang keine verlässliche Restore-Ausführung ermöglicht. Der Restore-Pfad muss deshalb ohne allgemeine Remote-Shell, mit eindeutigem Freigabeprozess und belastbarer Evidenz verfügbar sein.

## Was ändert sich

- Der Backup-Agent erhält einen minimalen, versionierten Vertrag `restore-and-verify-v1` für vollständige Datenbankrestores.
- Ein dedizierter GitHub-Actions-Workflow ist der einzige Aufrufer des Restore-Vertrags; direkte Operator-HTTPS-Aufrufe bleiben ausgeschlossen.
- Restore-Aufträge sind an Umgebung, einen vorhandenen MinIO-Objektpfad, dessen SHA-256, eine eindeutige Request-ID, ein Wartungsfenster und die GitHub-Environment-Freigabe gebunden.
- Vor jedem Restore wird ein frischer, verifizierter Sicherheitsdump derselben Zielumgebung erzeugt.
- Der Agent akzeptiert nur die fest verdrahtete Datenbank der Zielumgebung und führt keine frei übergebenen Shell-Befehle oder Datenbankparameter aus.
- Der Auftrag wird fail-closed abgelehnt, wenn die kontrollierte App-Stilllegung mit Session-Drain, Objekt-/Prüfsummenprüfung, Schema-Kompatibilität oder Freigabe nicht nachweisbar sind.
- Nach dem Restore führt der Ablauf Schema-, App-Principal-, Registry-, Health- und Tenant-Login-Prüfungen aus. Bei jeder fehlgeschlagenen Nachprüfung bleibt die App stillgelegt und der Run erfordert eine manuelle Recovery-Entscheidung.
- Keycloak wird durch den Datenbankrestore nicht verändert. Möglicher externer Drift wird dokumentiert und ausschließlich über bestehende, getrennte Reconcile-Pfade behandelt.

## Auswirkungen

- Betroffene Specs: `deployment-topology`
- Betroffene Systeme: `studio-backup-agent`, dedizierter Restore-Workflow, GitHub Environments, MinIO-Backup-Buckets, Studio-PostgreSQL, Restore-Principal und kontrollierte App-Stilllegung
- Betroffene Dokumentation: `docs/guides/swarm-deployment-runbook.md`, ADR-048 sowie arc42-Abschnitte 06, 07, 08, 09 und 11
- Sicherheitswirkung: hoch; der Agent bleibt eine bewusst breite Vertrauenszone, erhält jedoch keine allgemeine Kommandoausführung.
