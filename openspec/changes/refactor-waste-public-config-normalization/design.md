## Context

`normalizeWasteManagementEmailReminderConfig` schützt eine öffentliche Konfigurationsgrenze. Die Funktion liest untypisierte Werte, verwirft ungültige Pflicht- und optionale Werte fail-closed und baut ein kanonisch normalisiertes Objekt auf. Das separate Signing-Secret darf nur über den bestehenden Secret-Reader und nur zusammen mit einer gültigen Reminder-Konfiguration lesbar sein.

## Goals / Non-Goals

- Goals:
  - bestehende Entscheidungspunkte durch Characterization festschreiben
  - reine, kleine Parser entlang fachlicher Feldgruppen extrahieren
  - exakte Ausgabeform und Secret-Grenze erhalten
  - Komplexität ohne Suppression senken
- Non-Goals:
  - keine generische Schema- oder Validator-Factory
  - keine neue Abhängigkeit
  - keine neuen Defaults, Felder oder Fehlermeldungen
  - keine Änderung an Consumer-, Persistenz- oder Laufzeitverträgen

## Decisions

### Decision: Die Orchestrierung bleibt explizit und fail-closed

Der Einstieg prüft weiterhin zuerst die Objektform und die beiden Boolean-Pflichtfelder. Danach werden Pflichtstrings, Pflichtgrenzwerte und optionale Gruppen in derselben fachlichen Reihenfolge gelesen. Jeder ungültige Pflichtwert oder jeder explizit ungültige optionale Wert verwirft die gesamte Konfiguration.

### Decision: Parser spiegeln echte Feldgruppen

Extrahiert werden ausschließlich reine Parser für bereits vorhandene Entscheidungsgrenzen: String- und Integer-Gruppen, öffentliche Basis-URL, Rechtslinks, relative Pfade und E-Mail-Adressen. Der finale Objektaufbau bleibt explizit, damit Feldnamen, Optionalität und Serialisierungsreihenfolge sichtbar bleiben.

### Decision: Characterization ist die Paritätsreferenz

Vor der Sourceänderung sichern Tests gültige Voll- und Minimalwerte, partielle Pflichtverletzungen, explizit ungültige optionale Werte, unbekannte Felder, URL-/Pfadnormalisierung, Output-Serialisierung und die Secret-Grenze. Die Refaktorierung darf diese Erwartungen nicht verändern.

## Risks / Trade-offs

- Eine versehentlich andere Reihenfolge beim Objektaufbau könnte byteweise JSON-Ausgabe verändern. Die Characterization vergleicht deshalb die serialisierte Ausgabe.
- Optionalwerte unterscheiden zwischen fehlend, leer und explizit ungültig. Die Parser bewahren diese drei Zustände typsicher.
- Zu generische Abstraktionen würden die fachliche Regelreihenfolge verdecken. Die Extraktion bleibt bewusst lokal und feldgruppenspezifisch.

## Migration Plan

Es gibt keine Daten- oder Konfigurationsmigration. Bei einer Paritätsabweichung wird die Refaktorierung zurückgenommen; die Characterization bleibt als Vertragsbeleg bestehen.

## Open Questions

Keine. Änderungen an Defaults oder Validierungsregeln sind ausdrücklich ausgeschlossen.
