# Change: Asynchrone Medienverarbeitung ergänzen

## Why

Das aktuelle Medienmanagement erzeugt häufige Bildvarianten synchron im Upload-Pfad. Das ist für den MVP bewusst akzeptabel, belastet aber Latenz, Fehlerisolation und spätere Erweiterungen wie Malware-Scan, zusätzliche Presets oder größere Batch-Migrationen.

Gleichzeitig soll für langlaufende Studio-Operationen keine zweite, media-spezifische Job-Architektur entstehen. Die spätere Medienverarbeitung muss deshalb an die generische Studio-Job-Fähigkeit andocken, die im Change `add-waste-management-plugin` erstmals als plattformweite Grundlage beschrieben wird.

## What Changes

- stellt Medienverarbeitung auf ein async-first-Zielbild um: Upload bestätigt nur Validierung, Annahme und Job-Anlage
- verlagert Variantenverarbeitung und nachgelagerte technische Prüfungen aus dem regulären Request-Pfad in einen späteren generischen Studio-Job-Lauf
- hält `MediaReference` sofort referenzierbar, trennt aber Asset-Nutzbarkeit und Verarbeitungsfortschritt explizit
- definiert Delivery-Fallbacks für `processing`-Assets über Originalmedium oder Placeholder statt stillschweigender Sofort-Varianten
- richtet Medienjobs ausdrücklich an der generischen Studio-Job-Fähigkeit aus, statt in diesem Change eine eigene Queue-/Job-Plattform festzulegen
- übernimmt für die erste Ausbaustufe bewusst nicht mehr als das bereits plattformweit vorgesehene Jobmodell; insbesondere werden automatische Media-Sonder-Retries nicht vorgezogen

## Impact

- Affected specs:
  - `media-management`
- betrifft `packages/auth-runtime`, `packages/data`, `packages/data-repositories` und die Betriebsdokumentation
- erweitert Upload-, Delivery- und Statusverträge für asynchron verarbeitete Medienassets
- hängt in der Umsetzung von der generischen Studio-Job-Fähigkeit aus `add-waste-management-plugin` oder einem gleichwertig vorgelagerten Plattform-Change ab
- reduziert das bekannte Risiko aus synchroner Variantenverarbeitung im Request-Pfad, ohne die Job-Plattform in diesem Change vorwegzunehmen
