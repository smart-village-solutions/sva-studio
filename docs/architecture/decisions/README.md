# Legacy ADRs (`docs/architecture/decisions/`)

Dieses Verzeichnis ist ein Archiv einer älteren ADR-Serie und nicht der kanonische Ablageort für aktuelle Architekturentscheidungen.

## Verbindliche Regeln

- Neue und fortgeschriebene ADRs liegen unter `../../adr/`.
- Aktuelle Architektur-, Guide- und PR-Dokumentation muss auf `docs/adr/` verweisen.
- Die Dateinummern in diesem Archiv überschneiden sich teilweise mit der kanonischen ADR-Serie unter `docs/adr/`.
- Historische Dateien hier dienen nur dem Kontext aus älteren PRs, Proposals und Notizen.

## Bereits migriert

- Die weiterhin gültigen einzigartigen Entscheidungen ADR-001 bis ADR-008 liegen nun kanonisch unter `../../adr/`.
- Die Layout-Shell-Entscheidung aus der kollidierenden Legacy-Nummer 009 liegt kanonisch als `../../adr/ADR-053-layout-shell-skeleton-architecture.md` vor. Die nahezu identische Legacy-Datei mit Nummer 008 bleibt nur als historischer Kontext erhalten.
- `ADR-018-auth-routing-error-contract-und-korrelation.md` ist nach `../../adr/ADR-018-auth-routing-error-contract-und-korrelation.md` migriert.
- Die gleichnamige Datei in diesem Verzeichnis bleibt nur als Legacy-Platzhalter bestehen, damit alte Referenzen nicht ins Leere laufen.

## Umgang mit diesem Archiv

- Keine neuen ADRs in diesem Ordner anlegen
- Keine bestehenden Legacy-Dateien als maßgebliche Quelle zitieren
- Bei relevanten Altentscheidungen zuerst prüfen, ob bereits eine kanonische Fassung unter `docs/adr/` existiert
