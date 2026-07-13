# Change: Lokales MCP-Tool für die Anlage von Studio-Instanzen

## Why

Operatoren sollen neue Studio-Instanzen aus Codex oder einer CLI heraus kontrolliert anlegen können, ohne einen zweiten Provisioning-Pfad oder direkte Datenbankzugriffe einzuführen. Die bestehende Studio-API und die Instance Registry bleiben dabei die fachlich und sicherheitstechnisch führende Grenze.

## What Changes

- Ein lokaler stdio-MCP-Server erhält das Tool `studio_instances_create` und ruft damit den bestehenden Studio-Endpunkt zur Instanzanlage auf.
- Studio akzeptiert für diesen klar abgegrenzten Maschinenpfad dedizierte, kurzlebige Service-Tokens und ordnet sie einem auditierbaren Akteur zu.
- Der Maschinenpfad prüft Token-Aussteller, -Zielumgebung, -Ablauf und die minimal nötige Berechtigung; Browser-Session, CSRF und Fresh-Reauth bleiben für interaktive Aufrufe unverändert gültig.
- Das MCP-Tool validiert den bestehenden Create-Vertrag, verwendet Idempotenz- und Korrelationskennungen und gibt weder Tokens noch andere Geheimnisse zurück oder aus.
- Studio und MCP führen einen versionierten, maschinenlesbaren Fehlervertrag mit stabilen Fehlerklassen, Wiederholbarkeit, sicherer Folgeaktion und Korrelation ein.
- Nach einem fehlgeschlagenen Create-Aufruf ergänzt das MCP-Tool eine begrenzte, Read-only-Diagnose; deren Evidenz bleibt geheimnisfrei und verändert keinen Instanzzustand.
- Der lokale MCP-Server stellt die vorhandene Instanz-Control-Plane als dreistufige Tool-Fläche für Lesen/Diagnose, kontrollierte Mutationen und kritische Mutationen bereit.
- Kritische Mutationen wie Aktivierung, Suspendierung, Archivierung, Modulentzug und Secret-Rotation verlangen serverseitig gebundene, kurzlebige Bestätigungs-Challenges, einen engsten Action-Scope sowie einen aktuellen Vorab-Read oder Plan.

## Impact

- Affected specs: `instance-provisioning`, `iam-access-control`, `iam-auditing`
- Affected code: neue lokale MCP-Library, Studio-API-Authentisierung und -Autorisierung für den Service-Token-Pfad, vorhandene Instance-Registry-HTTP-Integration
- Affected arc42 sections: [03 Kontext und Scope](../../../docs/architecture/03-context-and-scope.md), [04 Lösungsstrategie](../../../docs/architecture/04-solution-strategy.md), [05 Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [06 Laufzeitsicht](../../../docs/architecture/06-runtime-view.md), [08 Querschnittliche Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md), [09 Architekturentscheidungen](../../../docs/architecture/09-architecture-decisions.md)
