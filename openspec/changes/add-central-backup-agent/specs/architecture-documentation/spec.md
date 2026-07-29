## ADDED Requirements

### Requirement: Architektur dokumentiert die zentrale Backup-Vertrauenszone

Die Architektur- und Betriebsdokumentation SHALL den zentralen Studio-Backup-Agenten, dessen umgebungsgebundenen Auftragsvertrag und seine bewusst gemeinsame Vertrauensgrenze nachvollziehbar beschreiben.

#### Scenario: Operator bewertet Zugriff und Ausführungspfad

- **WHEN** ein Operator den Backup-Betrieb für Staging oder Production nachvollzieht
- **THEN** beschreiben Arc42-Baustein-, Laufzeit-, Verteilungs- und Querschnittssicht den zentralen Agenten, die beiden internen Netze, das bestehende Traefik-Netz, getrennte Secrets, GitHub-OIDC- und Signaturprüfung, MinIO-Control- und Evidenzobjekte sowie den auf einen HTTPS-`POST`-Pfad begrenzten Ingress
- **AND** beschreibt eine ADR die Entscheidung für einen gemeinsamen Agenten gegenüber zwei umgebungsgetrennten Agenten
- **AND** benennt das Runbook Healthcheck, kontrollierten Neustart, Störungserkennung, Staging-Drill und Production-Freigabe

#### Scenario: Risiko des gemeinsamen Agents bleibt sichtbar

- **WHEN** ein Team die Architektur-Risiken prüft
- **THEN** dokumentiert die Risikobetrachtung den erweiterten Blast Radius des gemeinsamen Agenten
- **AND** nennt sie minimale Imagefläche, keine allgemeine Kommandoausführung, signierte Aufträge, getrennte Secrets, Umgebungs-Allowlist und dauerhafte Evidenz als Gegenmaßnahmen
