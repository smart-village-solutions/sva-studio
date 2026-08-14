## Context

Die Postleitzahl gehört zum Datensatz in `waste_cities` und gilt damit für alle zugeordneten Abholorte. Der bestehende Karten-/Geocoding-Pfad ist hostgeführt und tenantkonfiguriert; das Waste-Plugin darf weder Provider-Secrets lesen noch hunderte Browseranfragen ausführen.

## Goals / Non-Goals

- Goals: fehlende deutsche Postleitzahlen konservativ und wiederholbar ergänzen, vorhandene Werte schützen, Fortschritt und Ergebnis nachvollziehbar machen.
- Non-Goals: vorhandene Postleitzahlen korrigieren, mehrdeutige Treffer erzwingen, das City-Level-Datenmodell für Orte mit mehreren Postleitzahlen ersetzen oder einen neuen Geocoding-Provider einführen.

## Decisions

- Die Aktion läuft als Job `waste-management.enrich-postal-codes` über den bestehenden Plugin-Operations-Vertrag.
- Der Startpfad verlangt `waste-management.master-data.manage`, CSRF-Schutz, Idempotency-Key, Actor-Kontext und Instanzbindung.
- Die Host-Runtime injiziert eine Geocoding-Funktion. Das Plugin kennt weder Provider noch Secrets.
- Der Job verarbeitet ausschließlich Städte mit leerer Postleitzahl und prüft unmittelbar vor dem Schreiben atomar erneut, dass der Wert weiterhin leer ist.
- Eine im Ortsnamen eingebettete einzelne deutsche fünfstellige Postleitzahl gilt als deterministischer Treffer. Andernfalls werden bis zu drei deterministisch verteilte Straßenstichproben mit Ort, Region und Land geocodiert.
- Automatisch übernommen wird nur eine deutsche fünfstellige Postleitzahl, die in allen verwertbaren Stichproben übereinstimmt und deren normalisierter Providertext den Ortsnamen wortgrenzensicher enthält. Ist eine Waste-Region vorhanden, muss außerdem mindestens eine strukturierte Providerregion oder das Providerlabel diese Region nach beidseitiger Entfernung üblicher Verwaltungspräfixe wortgrenzensicher enthalten. Widersprüche bleiben offen.
- Der Job arbeitet seriell und hält das konfigurierte Provider-Limit ein. Providerfehler verändern keine Fachdaten.
- Der Geoapify-Resolver begrenzt einen Lauf zusätzlich auf 3.000 Provideranfragen und weist ein ausgeschöpftes Budget als kontrolliertes Teilergebnis aus. Das schützt einen einzelnen Lauf; das kontoweite Tageskontingent bleibt providerseitig maßgeblich, weil auch andere Geocoding-Funktionen Credits verbrauchen können.
- Eine einzelne lange Datenbanktransaktion über externe Requests wird vermieden; bestätigte Ergebnisse werden in kurzen konditionalen Batches gespeichert. Vor dem Weiterreichen eines Providerfehlers oder Abbruchs wird ein ausstehender Batch noch gesichert.

## Risks / Trade-offs

- Manche Städte besitzen mehrere Postleitzahlen. Das aktuelle City-Level-Modell kann das nicht eindeutig ausdrücken; widersprüchliche Treffer bleiben deshalb unverändert.
- Strenge Plausibilitätsregeln können echte Treffer offenlassen. Das ist sicherer als falsche Push-Zielschlüssel.
- Große Bestände benötigen abhängig vom Provider-Limit mehrere Minuten. Der Hintergrundjob hält den Browser davon unabhängig.

## Migration Plan

Es ist keine Schemaänderung erforderlich. Nach regulärem Rollout kann ein berechtigter Administrator den idempotenten Job je Instanz starten. Ein Rollback des Codes lässt bereits korrekt ergänzte Postleitzahlen unverändert.

## Open Questions

- Keine.
