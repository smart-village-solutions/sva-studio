## Context

Der Host besitzt bereits einen kanonischen Build-time-Registry-Snapshot und eine Namespace-Governance für Plugin-Identifier. Dieser Change schärft nicht erneut die Identifier- oder Snapshot-Regeln, sondern die Durchsetzungsgrenze: Plugin-Packages dürfen fachliche Erweiterungen liefern, aber keine Host-Infrastruktur umgehen.

Die Guardrails müssen bewusst schmal bleiben. Ein pauschales Verbot ausführbaren Plugin-Codes wäre zu teuer, weil UI-Komponenten, Fachansichten und clientseitige Interaktionen weiterhin echte Plugin-Erweiterungen sind. Verboten sind nur ausführbare Beiträge, die Host-owned Routing, IAM, Audit, Validierung oder Persistenzpfade ersetzen oder umgehen.

## Decisions

### Contribution Boundary

Erlaubt sind deklarative Registry-Beiträge und hostunterstützte UI-Bindings:

- Plugin-Metadaten, Namespace, Ressourcen- und Content-Type-Identifier
- Route-, Navigation-, Search-Param-, Action- und Audit-Event-Deklarationen
- React/UI-Komponenten innerhalb einer vom Host materialisierten Route oder Shell
- fachliche Client-Interaktion, solange sie über hostkontrollierte Actions, Datenzugriffe und Auditpfade läuft

Verboten sind Plugin-Beiträge, die Infrastrukturentscheidungen ausführen:

- eigene Runtime-Routen oder Route-Handler außerhalb des Registry-Vertrags
- eigene Autorisierungsentscheidungen, Guard-Funktionen oder Permission-Resolver
- direkte Audit-Emission außerhalb des Host-Audit-Pfads
- direkte Persistenz-, Request- oder Server-Handler, die Host-Validierung umgehen
- dynamische Nachregistrierung von Beiträgen nach Veröffentlichung des Build-time-Snapshots

### Enforcement Layers

Die Durchsetzung erfolgt gestaffelt:

1. Das Plugin-SDK modelliert zulässige Contribution-Felder typsicher und bietet keine öffentlichen Felder für Host-owned Entscheidungen an.
2. Die Registry validiert den Build-time-Snapshot deterministisch und bricht bei Guardrail-Verletzungen fail-fast ab.
3. Routing, IAM und Audit materialisieren nur normalisierte Host-Beiträge aus dem validierten Snapshot.
4. Tests decken erlaubte UI-Erweiterungen sowie verbotene Bypass-Versuche ab.

### Diagnostics

Guardrail-Verletzungen liefern deterministische Fehlercodes, damit CI, Reviews und Support nicht auf Freitext angewiesen sind:

- `plugin_guardrail_route_bypass`
- `plugin_guardrail_authorization_bypass`
- `plugin_guardrail_audit_bypass`
- `plugin_guardrail_persistence_bypass`
- `plugin_guardrail_dynamic_registration`
- `plugin_guardrail_unsupported_binding`

Die konkrete Diagnose soll mindestens Plugin-Namespace, Contribution-ID, verletzte Guardrail-Klasse und betroffenen Host-Bereich enthalten.

## Consequences

Der Host wird komplexer, weil er zulässige Extension Points explizit modellieren muss. Diese Kosten sind akzeptabel, solange der Change nur sicherheits- und infrastrukturseitige Bypässe verhindert und nicht fachliche UI-Erweiterungen blockiert.

Wenn ein Plugin künftig neue Infrastruktur braucht, wird zuerst ein neuer Host-Extension-Point spezifiziert. Plugins dürfen solche Infrastruktur nicht ad hoc selbst etablieren.
