## Context

Der aktuelle Plugin-Vertrag besitzt bereits einen Build-time-Registry-Snapshot und host-erzwungene Guardrails. Die Registry ist aber noch flach: Sie normalisiert und validiert mehrere Beitragstypen, macht die Materialisierungsreihenfolge aber nicht als Vertrag sichtbar.

Dieser Change baut auf den Guardrails auf. Er erweitert nicht die Sicherheitsgrenze, sondern macht die Reihenfolge der erlaubten statischen Beiträge explizit.

## Decisions

### Scope

Der Change strukturiert die bestehende Registry-Erzeugung. Er fuehrt kein neues Plugin-System, keine neuen Beitragstypen und keine harte Breaking-API ein.

### Kanonische Phasen

Die Build-time-Registry verarbeitet Plugin-Beiträge in dieser Reihenfolge:

1. `preflight`: Plugin-Namespace, erlaubte Felder und Guardrail-Shape prüfen
2. `content`: Content-Type-Beiträge normalisieren und als `contentTypeRegistry` veröffentlichen
3. `admin`: Admin-Ressourcen gegen den bestehenden Admin-Vertrag validieren
4. `audit`: Audit-Event-Deklarationen normalisieren und als `pluginAuditEventRegistry` veröffentlichen
5. `routing`: Plugin-Routen und host-materialisierte Admin-Routen gegen Action-, Guard- und Admin-Outputs validieren
6. `publish`: Einen unveränderlichen Snapshot für `@sva/routing` und den App-Host bereitstellen

`preflight` ist eine technische Vorphase, keine fachliche Plugin-Capability. Sie ist notwendig, damit spätere Phasen nur normalisierte und guardrail-konforme Beiträge sehen. Semantische Verknuepfungen wie Route-zu-Action oder Navigation-zu-Action bleiben in den bestehenden Registry-Validierungen und werden nur phasenweise sichtbar gemacht.

### Phasenoutputs

Die Phasen erzeugen die bereits vorhandenen Registry-Outputs:

- `preflight`: normalisierte `plugins` und `pluginRegistry`
- `content`: `contentTypes`
- `admin`: `adminResources` und `adminResourceRegistry`
- `audit`: `auditEvents` und `pluginAuditEventRegistry`
- `routing`: `routes`, `navigation` und `pluginActionRegistry`
- `publish`: den bestehenden `BuildTimeRegistry`-Snapshot

Die Outputs sollen die heutige Public-API von `createBuildTimeRegistry()` erhalten. Neue interne Phasenhelfer duerfen eingefuehrt werden, solange bestehende Consumer nicht auf einen neuen Snapshot-Typ migrieren muessen.

### Implementierungsgrenze

Der primäre Vertrag liegt in `@sva/plugin-sdk`. `@sva/sdk` bleibt Adapter/Re-Export für bestehende Konsumenten. Neue Phasen-Typen und Snapshot-Strukturen werden zuerst im Plugin-SDK modelliert.

`@sva/routing` soll validierte Snapshot-Outputs bevorzugt konsumieren, darf aber für bestehende Aufrufer weiterhin direkte Plugin-Definitionen akzeptieren und fail-fast prüfen. Dieser Change erzwingt keinen harten Umbau aller Routing-Signaturen.

### Diagnostics

Phasenfehler verwenden die bestehenden deterministischen Guardrail-Fehlercodes, wenn eine Host-Grenze verletzt wird:

- `plugin_guardrail_route_bypass`
- `plugin_guardrail_authorization_bypass`
- `plugin_guardrail_audit_bypass`
- `plugin_guardrail_persistence_bypass`
- `plugin_guardrail_dynamic_registration`
- `plugin_guardrail_unsupported_binding`

Reine Abhängigkeitsfehler sollen ebenfalls deterministisch sein und Plugin-Namespace, Contribution-ID und fehlende Abhängigkeit enthalten. Dieser Change führt aber keine neuen Content-Extension- oder Action-Audit-Abhängigkeitsfelder ein.

## Consequences

Die Build-time-Registry wird etwas ausführlicher, aber besser testbar: Jede Phase hat Eingaben, Outputs und Fehlerfälle. Spätere Extension Points müssen sich explizit einer Phase zuordnen oder einen neuen Change mit eigenem Vertrag erhalten.
