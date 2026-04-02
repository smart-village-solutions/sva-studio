## Kontext

Das Projekt arbeitet bewusst SQL-first und verwaltet sicherheitsrelevante Postgres-Artefakte wie RLS, Policies, Rollen, Grants und Constraints direkt in SQL. Das Migrationswerkzeug darf diese Ebene nicht abstrahieren, muss aber einen standardisierten Betriebsrahmen für Status, Ausführung und Diagnose bereitstellen.

## Ziele / Nicht-Ziele

- Ziele:
  - OSS-konformes Standardtool für SQL-Migrationen
  - reproduzierbarer Tool-Pfad ohne globale Installation
  - kanonischer, eindeutiger Migrationspfad
  - Integration in lokale Runtime-Profile und Acceptance-Deploys
- Nicht-Ziele:
  - Umstieg auf ORM-/Model-first-Migrationen
  - Entfernung der bestehenden Schema-Guards im selben Change
  - vollständige Neukonzeption der IAM-Schema-Architektur

## Entscheidungen

- Entscheidung: `goose` wird über einen repo-lokalen Wrapper mit gepinnter Version bereitgestellt.
  - Alternativen: System-Binary, reiner Container-Wrapper
- Entscheidung: Der historische SQL-Bestand wird in-place in `goose`-Dateien mit `Up`/`Down` überführt.
  - Alternativen: Baseline, Hybridbetrieb
- Entscheidung: Die historische Versionsfolge wird einmalig neu nummeriert und anschließend eingefroren.
  - Alternativen: Legacy-Präfixe weitgehend beibehalten, Timestamps
- Entscheidung: Acceptance-Migration lädt die gepinnte `goose`-Binary temporär im Zielkontext nach, statt eine Vorinstallation vorauszusetzen.
  - Alternativen: serverseitige Installation, permanenter Migrationscontainer

## Risiken / Trade-offs

- Renummerierung erzeugt Churn in Code, Tests und Doku.
  - Mitigation: zentrale Mapping-Tabelle und konsistente Referenzaktualisierung
- `goose` ist nicht TypeScript-first.
  - Mitigation: Kapselung hinter Nx-/Shell-/Runtime-Interfaces
- Remote-`goose`-Ausführung im Acceptance-Pfad benötigt robustes temporäres Tool-Handling.
  - Mitigation: gepinnte Download-URL, temporäre Dateiablage, klare Cleanup-Logik

## Migrationsplan

1. Wrapper und Tool-Konfiguration einführen
2. Historische SQL-Dateien in kanonische `goose`-Dateien überführen
3. Lokale Nx-/Script-Pfade umstellen
4. Runtime-/Acceptance-Pfade umstellen
5. Referenzen, Tests und Doku aktualisieren
6. Validierung `up -> down -> up`, Seeds und RLS ausführen
