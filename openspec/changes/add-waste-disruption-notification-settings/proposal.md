# Change: Störungshinweise tenantbezogen in `wasteTypes` konfigurieren

## Why

Die Smart-Village-App erkennt ortsbezogene und globale Störungshinweise ausschließlich über die Sondertypen `disruption_location` und `disruption_all_locations` im Mainserver-Static-Content `wasteTypes`. Manuell im Mainserver ergänzte Einträge gehen beim nächsten Studio-Sync verloren, weil das Studio das Dokument vollständig aus regulären Waste-Fraktionen neu erzeugt.

## What Changes

- Die tenantbezogene Waste-Konfiguration erhält zwei voneinander unabhängige, standardmäßig deaktivierte Optionen für Hinweise zu „Meine Straße“ und „Alle Straßen“.
- Die Optionen werden in der bestehenden tenantlokalen Singleton-Konfiguration `waste_settings` gespeichert und nicht als Waste-Fraktionen modelliert.
- Der `wasteTypes`-Builder bildet reguläre Fraktionen und Störungstypen als getrennte typsichere Varianten ab.
- Aktivierte Störungstypen werden unter den exakt kleingeschriebenen Schlüsseln `disruption_location` und `disruption_all_locations` deterministisch in das vollständige `wasteTypes`-Dokument aufgenommen.
- `fractionCount` zählt weiterhin ausschließlich aktive reguläre Fraktionen.
- Das erfolgreiche Speichern der Optionen reiht wie eine Fraktionsmutation automatisch den bestehenden Job `waste-management.sync-waste-types` ein; ein Sync-Fehler macht die lokale Speicherung nicht rückgängig und bleibt über Warnung und Retry behandelbar.
- Deutsche und englische UI-Texte, Tests, Waste-Schemadokumentation und die Runtime-Dokumentation werden aktualisiert.

## Approval Status

Das fachliche Zielbild und der automatische Sync nach erfolgreicher Speicherung wurden im Dialog am 1. September 2026 bestätigt. Die Implementierung beginnt nach Review und Freigabe dieses schriftlichen OpenSpec-Changes.

## Scope Clarification

- Im Scope:
  - tenantbezogene Persistenz beider Optionen mit sicherem Default `false`;
  - unabhängige, zugängliche Schalter in den Waste-Einstellungen;
  - vollständige deterministische `wasteTypes`-Erzeugung aus Fraktionen und Störungskonfiguration;
  - automatisches Einreihen des bestehenden Sync-Jobs nach erfolgreichem Speichern;
  - Warnungs- und Retry-Verhalten entsprechend den bestehenden Fraktionsmutationen.
- Nicht im Scope:
  - Änderungen an der mobilen App oder Push-Zustellung;
  - Modellierung der Störungstypen als Fraktionen;
  - Übernahme unbekannter Mainserver-Einträge;
  - automatische Aktivierung für Bestandsmandanten;
  - Änderung des Mainserver-Static-Content-Transportvertrags.

## Success Metrics

- Alle vier Kombinationen der beiden Optionen erzeugen exakt die erwarteten Sondertypen.
- Bestandsmandanten und fehlende Legacy-Felder verhalten sich wie `false`/`false`.
- Reguläre Fraktionsschlüssel und -einträge bleiben unverändert; Sondertypen durchlaufen keine Großschreibungsnormalisierung.
- Wiederholte Builds mit identischen Eingaben erzeugen identischen Inhalt und SHA-256-Hash.
- Ein gespeicherter Konfigurationswechsel reiht einen `waste-management.sync-waste-types`-Job ein und bleibt bei einem Sync-Fehler lokal erhalten.
- Deaktivierte Sondertypen fehlen nach dem nächsten erfolgreichen vollständigen Sync im Mainserver-Dokument.

## Impact

- Affected specs:
  - `waste-management`
- Expected affected code:
  - `packages/core/`
  - `packages/data-repositories/`
  - `packages/auth-runtime/`
  - `packages/plugin-waste-management/`
  - `apps/sva-studio-react/src/lib/waste-management-*`
- Affected documentation:
  - `docs/development/studio-db-schema-final.sql`
  - `docs/development/studio-db-schema.md`
- Affected arc42 sections:
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/10-quality-requirements.md`
