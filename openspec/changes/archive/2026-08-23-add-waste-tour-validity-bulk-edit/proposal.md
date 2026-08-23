# Change: Gültigkeitszeiträume ausgewählter Waste-Touren gesammelt ändern

## Why

Turnusbasierte Waste-Touren besitzen bereits ein tourweites Start- und Enddatum, können in der Tourenliste aber nur einzeln bearbeitet werden. Bei einem gemeinsamen Saison- oder Jahreswechsel führt das zu wiederholter manueller Pflege und erhöht das Risiko uneinheitlicher Gültigkeitszeiträume.

## What Changes

- Die bestehende Mehrfachauswahl der Tourenliste erhält die Aktion `Gültigkeitszeitraum ändern`.
- Ein Dialog erlaubt, `Gültig ab` und `Gültig bis` unabhängig voneinander unverändert zu lassen oder auf ein Datum zu setzen; ausschließlich `Gültig bis` kann entfernt werden, weil `Gültig ab` den Startanker des Turnus bildet.
- Ein dedizierter Bulk-Endpunkt validiert und speichert alle Änderungen serverseitig atomar.
- Die Änderung betrifft ausschließlich die tourweiten Felder `firstDate` und `endDate`; Einzeltermine, Datumsverschiebungen und Abholort–Tour-Zuordnungen bleiben unverändert.
- Nicht turnusbasierte Touren werden nicht stillschweigend geändert, sondern als nicht anwendbar ausgewiesen und serverseitig abgelehnt.
- Erfolgreiche und fehlgeschlagene Bulk-Aktionen werden nach dem bestehenden Audit-Standard nachvollziehbar protokolliert.

## Impact

- Affected specs: `waste-management`; der bestehende Standard `iam-auditing` für Bulk-Aktionen wird angewendet, aber nicht verändert.
- Affected code: Tourenliste und Dialog im `plugin-waste-management`, Waste-API-Fassade und Auth-Runtime, transaktionale Waste-Repositories/Loader sowie Unit-, API- und E2E-Tests.
- Affected arc42 sections: keine inhaltliche Änderung; die bestehenden Grenzen aus Abschnitt 5 und die Querschnittskonzepte aus Abschnitt 8 werden unverändert wiederverwendet.
- Datenbankschema und öffentliche Waste-Schnittstellen bleiben unverändert.
