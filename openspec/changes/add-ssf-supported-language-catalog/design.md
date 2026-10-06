## Context

SSF veröffentlicht unter `https://api.dialog.kassel.de/api/languages/supported` einen installationsübergreifend verwendbaren Katalog. Browserzugriffe sollen davon unabhängig bleiben; der vorhandene serverseitige Plugin-Adminpfad vermittelt die Daten.

## Goals / Non-Goals

- Goals: Auswahlen auf SSF-unterstützte Sprachcodes begrenzen; System- und Mandanteneditor konsistent versorgen; Ausfall des Katalogs darf Textarbeit nicht blockieren.
- Non-Goals: Katalog lokal persistieren, Sprachliste je Mandant konfigurieren, vorhandene Inhalte automatisch löschen oder SSF-Runtime-Vertrag ändern.

## Decisions

- Server lädt den Katalog beim vorhandenen V2-Admin-Lese-/Schreibaufruf mit kurzem Timeout und validiert seine Struktur.
- Ungültige Antwort, HTTP-Fehler oder Timeout ergeben `supportedLanguages: null`; die Admin-Antwort mit Inhalten bleibt erfolgreich.
- UI zeigt Katalogsprachen zur Auswahl. Beim Hinzufügen werden Name und Eigenname aus dem Katalog vorbelegt und bleiben redaktionell änderbar.
- Vorhandene nicht mehr gelistete Sprachen bleiben im gespeicherten Inhalt und werden nicht stillschweigend entfernt.

## Risks / Trade-offs

- Der zentrale Katalog ist eine Laufzeitabhängigkeit für Änderungen an Sprachauswahlen. Der Fehlerzustand wird angezeigt, Textfelder bleiben verfügbar.
- `de-DE` und andere gespeicherte Locale-Tags können einem Katalogcode über den Basiscode zugeordnet angezeigt werden; gespeichert wird der Wert erst bei einer bewussten Auswahl geändert.

## Migration Plan

Keine Datenmigration. Bestehende Locale-Werte bleiben erhalten.

## Open Questions

Keine.
