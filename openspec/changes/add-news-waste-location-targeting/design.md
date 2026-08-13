## Context

Der Mainserver kann Nachrichten-Payloads mit `wasteLocationKeys` an bereits vorbereitete Endgeräte ausliefern. Studio verwaltet Abholorte hierarchisch über Region, Stadt, Straße und Hausnummer. Nachrichten dürfen beim Ergänzen der Zielschlüssel keine fremden Payload-Felder verlieren.

## Goals / Non-Goals

- Goals: ortsbezogene Zielauswahl, verlustfreies Payload-Merging, sicherer globaler Push, barrierefreie tabellarische Mehrfachauswahl.
- Non-Goals: Geräte-Registrierung, Abonnementverwaltung, Push-Transport oder Änderung der öffentlichen News-Sichtbarkeit.

## Decisions

- Der News-Editor liest die vorhandene hostseitige Waste-Master-Data-API; `plugin-news` erhält keine direkte Abhängigkeit auf `plugin-waste-management`.
- Die umfangreichen Waste-Stammdaten werden erst beim Öffnen der Zielauswahl geladen. Ein dedizierter `targeting`-Scope lädt die benötigten Hierarchien parallel und lässt Tour-Zuordnungen nur aus diesem News-Read-Modell aus; der bestehende `locations`-Scope behält seine Tour-Zuordnungen für Waste-Filter und Zuordnungsansichten.
- Ausgewählt werden konkrete aktive Abholort-Datensätze. Hierarchiestufen dienen ausschließlich als Filter.
- Der externe Schlüssel lautet `{ street, zip, city }`; bei vorhandener Hausnummer enthält `street` den zusammengesetzten Wert. Ohne Hausnummer bezeichnet der Schlüssel die gesamte Straße.
- Städte erhalten dafür im mandantenspezifischen Waste-Schema die optionale Spalte `postal_code`. Neu auswählbar sind nur aktive Abholorte mit vollständigem Stadt-, PLZ- und Straßenbezug; eine Hausnummer ist optional.
- Formzustand und Mutation führen das vollständige bestehende Payload mit. Nur `wasteLocationKeys` wird ersetzt oder bei globalem Versand entfernt.
- Nicht auflösbare gespeicherte Schlüssel bleiben als veraltete Ziele sichtbar und erhalten.
- Der Dialog bearbeitet eine temporäre Auswahl. Erst „Auswahl übernehmen“ verändert das Formular.
- Nach einer bestätigten Push-Zustellung ist die Zielauswahl schreibgeschützt, damit das gespeicherte Payload die historische Empfängergruppe weiterhin beschreibt.
- Stadt-Updates verwenden feldselektive PATCH-Semantik bis zur SQL-Anweisung. Ausgelassene Felder bleiben unverändert; nur ein explizites `null` entfernt PLZ oder Region.

## Risks / Trade-offs

- Mehrere Abholorte können denselben externen Schlüssel ergeben. Die Mutation dedupliziert deshalb anhand aller drei Felder.
- Waste-Daten können fehlen oder nicht lesbar sein. Ohne Berechtigung bleibt der Zielgruppenbereich verborgen; bei einem Ladefehler bleibt er sichtbar, erhält einen Fehlerzustand und kann erneut geladen werden. Das bestehende Payload bleibt unangetastet.
- Der globale Leerzustand ist rückwärtskompatibel, aber riskant. Vor einem tatsächlich auslösenden Push wird er explizit bestätigt.

## Migration Plan

Bestehende Nachrichten ohne `wasteLocationKeys` bleiben globale Nachrichten. Das idempotente Waste-Provisioning ergänzt `waste_cities.postal_code`; vorhandene Städte bleiben bis zur redaktionellen Ergänzung ihrer PLZ gültig, ihre Abholorte sind aber noch nicht als neue Push-Ziele auswählbar.

## Open Questions

- Keine.
