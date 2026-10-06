# Design: SSF-Inhalte V2

## Vertrags- und Trust-Grenzen

Die beiden [JSON-Schemas](../../../docs/api/ssf-installation-content-v2.schema.json) und [Runtime-Schemas](../../../docs/api/ssf-runtime-configuration-v2.schema.json) definieren die Ausgabe. Der Installationsendpunkt verlangt die bestehende technische Service-Identität, aber keinen Tenant-Header und keinen Tenant-Ausführungskontext. Der Runtime-Endpunkt verwendet dieselbe Service-Authentifizierung und die V1-Tenant-Bindung; `response.tenant.id` entspricht dem geprüften `X-Studio-Tenant-Id`. Beide Endpunkte lehnen ungültige oder unvollständige effektive Inhalte ab. Sie liefern keine Beispielwerte aus den Vertragsdateien als produktive Fallbacks.

Die Systemkonfiguration enthält installationsweite Werte und eine Mandantenvorlage. Tenant-Overrides liegen in der vorhandenen SSF-Tenant-Datenbankgrenze. Ein wirksamer Blattwert folgt Tenant-Override → Systemvorlage → freigegebenem Produktdefault. Für neue V2-Pflichtfelder ohne freigegebenen Default bleibt der Abruf bis zur Konfiguration nicht verfügbar. Das UI folgt dem [abgestimmten Aufbau](../../../docs/development/ssf-v2-inhaltsverwaltung-ui.md).

## Persistenz und Bearbeitung

Die Migration erweitert die vorhandenen System-/Tenant-Konfigurationsdaten additiv. V2-Änderungen werden transaktional und nur über die vorhandenen System-/Tenant-Actions gespeichert. Tenant-Reads und -Writes bleiben an den verifizierten Tenant gebunden. Admin-Eingaben werden client- und serverseitig validiert; HTML wird serverseitig bereinigt. Die UI erhält die nicht bearbeitbaren Felder und unbekannte Feedbackfragen beim Speichern.

Die fünf bekannten Feedback-IDs, Typen, Skalen und ihre Reihenfolge sind in der ersten UI fest. Texte, Pflichtangabe und Freitextgrenze sind einzeln editier- und vererbbar. Ein zusätzlicher Fragetyp erfordert zuerst SSF-Unterstützung; die Studio-UI erfindet keine neuen Typen. Für `mode=disabled` sind die wirksame Aufbewahrungsdauer und alle Speicherfragen `null`.

## Revision und Caching

Jede Antwort erhält einen SHA-256-Fingerprint der kanonisierten effektiven Antwort ohne Revisionsfeld. Reine DB-Änderungen ohne Wirksamkeit ändern die Revision nicht. Studio berechnet die Antwort bei jedem Abruf neu; insbesondere `conversationContentStorage.mode` darf nicht aus einem veralteten Fachcache kommen. V1-Revisionsbildung und V1-Antwort bleiben unverändert.

## Failure Modes und Nachweis

| Invariante | Ausfallverhalten | Nachweis |
| --- | --- | --- |
| Servicezugriff und Tenant-Bindung | 401/403 beziehungsweise bestehender Fehlervertrag; keine fremde Antwort | Handler-/Dispatcher-Tests mit fehlendem und fremdem Tenant |
| Installationsabruf ohne Tenant | Keine Tenantdaten und kein Tenant-Header erforderlich | Endpunkttest mit Service-Token ohne Tenant-Header |
| V2-Vertragsgültigkeit und Antwortgröße | Keine Teilantwort; fail-closed | Schema- und Größen-Grenztests für beide Antworten |
| `disabled` stoppt Gesprächsspeicherung | `retentionHours=null`, Speicherfragen `null` | Resolver- und Endpunkttests |
| Vererbung pro Feld | Ein Override ändert nur seinen Blattwert; Reset folgt Vorlage | Admin-/Repository- und UI-Tests |
| Unbekannte Fragen bleiben erhalten | Ein UI-Save löscht sie nicht | Persistenztest mit zusätzlicher Frage |
| V1 bleibt kompatibel | V1-Payload/Status unverändert | Bestehende V1-Vertragstests |

Die SSF-seitige Verwendung, Speicherung von Feedback und Browserabnahme erfolgen erst im integrierten System. Beispielangaben zu Aufbewahrung, Zweck und Links benötigen redaktionelle Freigabe.
