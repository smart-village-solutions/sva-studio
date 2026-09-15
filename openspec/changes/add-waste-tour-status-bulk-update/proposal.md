# Change: Waste-Touren mit Entwurf, Veröffentlicht und Archiviert verwalten

## Why

Waste-Touren besitzen derzeit nur den technischen Aktivstatus `active`. Für die redaktionelle
Arbeit werden jedoch die drei fachlichen Zustände `Entwurf`, `Veröffentlicht` und `Archiviert`
benötigt. Die bereits für Issue #1201 vorbereitete Mehrfachauswahl und atomare Sammelaktion soll
deshalb nicht als vorübergehende Aktiv-/Inaktiv-Lösung abgeschlossen, sondern auf dieses
Statusmodell erweitert werden.

## What Changes

- **BREAKING**: Der fachliche Tourvertrag ersetzt `active: boolean` durch den eindeutigen Status
  `draft | published | archived`; es entsteht kein dauerhaftes paralleles Statusmodell.
- Alle regulär neu angelegten, duplizierten oder in das Folgejahr übernommenen Touren starten als
  `draft`. Ein Import ohne expliziten Status verwendet ebenfalls `draft`.
- Bestehende Daten werden deterministisch migriert: `active = true` wird `published`,
  `active = false` wird `draft`; `archived` wird nicht aus Bestandsdaten geraten.
- Die Tourenliste bietet dieselben drei Werte für Filter, Status-Badge, Einzeländerung und die
  atomare Sammelaktion über manuell oder vollständig gefiltert ausgewählte Touren.
- Nur `published` gilt als operativ: Öffentlicher Kalender, Mainserver-Materialisierung,
  Abdeckungsprüfung, Reminder-/Exportprojektionen und Folgejahr-Quellauswahl schließen `draft`
  und `archived` aus.
- Archivierte Touren bleiben im Studio sichtbar, bearbeitbar und in jeden anderen Status
  überführbar.
- Der Schemawechsel wird wegen des isolierten Releasepfads der Public-Waste-App als kontrollierte
  Expand-/Migrate-/Contract-Sequenz ausgeführt. Eine zeitlich begrenzte, deterministisch
  synchronisierte `active`-Kompatibilität bleibt nur bis zur nachgewiesenen Umstellung aller
  Verbraucher bestehen und wird anschließend im selben Change entfernt.
- Legacy-Datenaustausch in Tourprofilversion `1.0.0` mit `active` bleibt lesbar; neue Exporte
  verwenden die Tourprofilversion `2.0.0` und schreiben ausschließlich `status`.

## Non-Goals

- Kein Vier-Augen-, Freigabe- oder Genehmigungsworkflow.
- Keine Statushistorie und keine automatische Archivierung.
- Kein Schreibschutz für archivierte Touren.
- Keine Änderungen an Tourinhalten, Gültigkeitszeiträumen, Terminen oder Zuordnungen.
- Kein generisches Bulk-Patch-Framework und keine neue Berechtigung.
- Keine Änderung des Legacy-Mainserver-Schemas oder der mobilen Smart Village App.

## Impact

- Affected specs: `waste-management`, `public-waste-calendar`
- Affected code: `@sva/core`, `@sva/plugin-sdk`, `@sva/data-repositories`,
  `@sva/auth-runtime`, `@sva/routing`, `@sva/plugin-waste-management`,
  `apps/sva-studio-react`, `apps/public-waste-calendar-web`
- Affected data: tenantbezogene Tabelle `waste_tours`, Tourfilter sowie JSON-Datenaustausch
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`,
  `docs/architecture/06-runtime-view.md`, `docs/architecture/08-cross-cutting-concepts.md`
- Related work: GitHub Issue #1201
