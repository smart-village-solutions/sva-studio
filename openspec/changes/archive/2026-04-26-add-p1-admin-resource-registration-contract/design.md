## Context

Der Admin-Bereich des Studios besitzt bereits mehrere CRUD-artige Bereiche wie Benutzer-, Rollen- und Inhaltsverwaltung. Diese Flaechen folgen fachlich aehnlichen Mustern, werden heute aber nicht ueber einen einheitlichen Registrierungsvertrag beschrieben. Dadurch muessen neue Fachmodule ihre Listen-, Detail- und Editor-Flaechen implizit oder hostspezifisch verdrahten.

## Goals

- Ein expliziter, deklarativer Registrierungsvertrag fuer Admin-Ressourcen aus Workspace-Packages
- Kanonische hostseitige Materialisierung fuer Listen-, Create- und Detailrouten
- Einheitliche Guard- und Metadatenanbindung fuer CRUD-artige Admin-Flaechen

## Non-Goals

- Kein generischer CMS-Funktionsvollausbau fuer Suche, Filter, Bulk-Actions oder Revisionen in diesem Change
- Keine vollstaendige Governance fuer alle Plugin-Tiers oder Lifecycle-Phasen
- Keine Laufzeit-Plugins; der Vertrag bleibt build-time und hostkontrolliert

## Decisions

- Eine `AdminResourceDefinition` beschreibt mindestens `resourceId`, `basePath`, `titleKey`, `guards` sowie Bindings fuer `list`, `create`, `detail` und optional `history`
- Der Host bleibt fuer die kanonischen Routen, Guard-Materialisierung und Konflikterkennung verantwortlich
- Packages liefern deklarative Beitraege; sie definieren nicht selbststaendig parallele Admin-Top-Level-Routen ausserhalb des Vertrags

## Risks / Trade-offs

- Ein zu frueh ueberladener Vertrag kann spaetere Host-Standards fuer Suche, Filter und Revisionen vorwegnehmen
- Ein zu schmaler Vertrag zwingt schnell zu hostseitigen Sonderpfaden und reduziert den Nutzen der Vereinheitlichung

## Open Questions

- Ob `history` bereits im Basiskontrakt Pflichtfeld oder zunaechst optionaler Beitrag sein soll
- Welche bestehende Ressource sich als erste Referenzmigration am besten eignet: `content`, `users` oder `roles`
