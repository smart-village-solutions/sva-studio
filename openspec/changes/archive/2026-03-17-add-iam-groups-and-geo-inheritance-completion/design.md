## Context

Die aktuelle Access-Control-Strecke deckt Rollen, Org-Hierarchie und einfache Geo-Scopes bereits ab. Für die vollständige Erfüllung von Paket 3 fehlen jedoch zwei zentrale Elemente: Gruppen als administrierbare Bündelung fachlicher Rechte und eine Geo-Vererbung, die über bloße Attributvergleiche hinausgeht.

## Goals / Non-Goals

- Goals:
  - Gruppenmodell fachlich und technisch definieren
  - Gruppen als Quelle effektiver Berechtigungen integrieren
  - Hierarchische Geo-Vererbung deterministisch auswerten
  - Admin-UI für Gruppenverwaltung und Gruppenzuweisung spezifizieren
- Non-Goals:
  - Redis-Snapshot-Lieferung
  - Mobile Content-Erstellung
  - Vollständiger Permission-Editor für beliebige Fachmodule

## Decisions

- Decision: Gruppen werden als explizite, instanzgebundene IAM-Entität modelliert.
  - Why: Das Angebot nennt `iam.groups` ausdrücklich; eine rein implizite Simulation über Rollen reicht nicht.
- Decision: Geo-Vererbung nutzt ein kanonisches Hierarchie-Read-Modell.
  - Why: Exakte String-Matches sind für Land -> Gemeinde -> Quartier fachlich unzureichend.
- Decision: Effektive Berechtigungen werden aus Rollen und Gruppen gemeinsam berechnet.
  - Why: Gruppen sollen fachlich wirksam sein und nicht nur UI-Metadaten liefern.

## Risks / Trade-offs

- Mehr Quellen für effektive Rechte erschweren Debugging.
  - Mitigation: Transparenzdaten und Reasoning explizit erweitern.
- Geo-Modell kann von realen Fachdaten abhängen.
  - Mitigation: Adapter- oder Mapping-Schnitt im Design festlegen.

## Migration Plan

1. Schema und Read-Modell für Gruppen und Geo-Hierarchie definieren
2. Effektive Berechtigungsauflösung erweitern
3. Admin-UI für Gruppen ergänzen
4. Test- und Doku-Nachweise ergänzen

## Open Questions

- Bündeln Gruppen direkt Permissions, Rollen oder beides?
- Welche geografische Hierarchiequelle ist im ersten Schnitt führend?
