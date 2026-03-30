# SonarCloud Issues und Security Hotspots

## Zweck

Dieses Projekt enthält ein kleines CLI, um Security Hotspots und normale Issues aus SonarCloud direkt abzurufen und zu pflegen, ohne die Weboberfläche manuell durchklicken zu müssen.

Das Skript liegt unter `scripts/ci/sonar-hotspots.ts` und nutzt die SonarCloud-API-Endpunkte für:

- Hotspots auflisten
- Details zu einem Hotspot anzeigen
- Hotspots als geprüft markieren
- mehrere Hotspots gesammelt als geprüft markieren
- Issues auflisten
- Details zu einem Issue anzeigen
- Issue-Transitions ausführen
- Kommentare an Issues anhängen

## Voraussetzungen

- Ein gültiges SonarCloud-Token mit Zugriff auf das Projekt
- Eine der Umgebungsvariablen `SONAR_TOKEN` oder `SONARQUBE_TOKEN`

Standardmäßig arbeitet das Skript mit dem Projekt `smart-village-app_sva-studio`.

Das Skript toleriert außerdem ein führendes `--`, damit Aufrufe über `pnpm <script> -- ...` funktionieren.

## Beispiele

Alle offenen Hotspots anzeigen:

```bash
tsx scripts/ci/sonar-hotspots.ts list
```

Nach Branch filtern:

```bash
tsx scripts/ci/sonar-hotspots.ts list --branch main
```

Auf einen Dateibereich eingrenzen:

```bash
tsx scripts/ci/sonar-hotspots.ts list --file-path-includes apps/sva-studio-react/src/components
```

Details zu einem Hotspot anzeigen:

```bash
tsx scripts/ci/sonar-hotspots.ts show --hotspot AXxxxx
```

Hotspot als geprüft markieren:

```bash
tsx scripts/ci/sonar-hotspots.ts review \
  --hotspot AXxxxx \
  --resolution SAFE \
  --comment "Kein Risiko im konkreten Kontext, da Inhalt vor dem DOM-Sink sanitisiert wird."
```

JSON-Ausgabe erzwingen:

```bash
tsx scripts/ci/sonar-hotspots.ts list --json
```

CSV-Ausgabe für Tabellen oder `jq`-freie Weiterverarbeitung:

```bash
tsx scripts/ci/sonar-hotspots.ts list --csv
```

Mehrere Hotspots gesammelt markieren:

```bash
tsx scripts/ci/sonar-hotspots.ts bulk-review \
  --hotspot AX111 \
  --hotspot AX222 \
  --resolution SAFE \
  --comment "Gleiche Schutzmaßnahme und gleiche technische Begründung."
```

Offene Issues abrufen:

```bash
tsx scripts/ci/sonar-hotspots.ts issues:list
```

Issues nach Typ und Status eingrenzen:

```bash
tsx scripts/ci/sonar-hotspots.ts issues:list --statuses OPEN,CONFIRMED --types BUG,VULNERABILITY
```

Issue-Details anzeigen:

```bash
tsx scripts/ci/sonar-hotspots.ts issues:show --issue AXxxxx
```

Issue-Status ändern:

```bash
tsx scripts/ci/sonar-hotspots.ts issues:transition --issue AXxxxx --transition accept --comment "Akzeptiert im konkreten Kontext"
```

Kommentar an ein Issue hängen:

```bash
tsx scripts/ci/sonar-hotspots.ts issues:comment --issue AXxxxx --comment "Fix ist im aktuellen Branch umgesetzt."
```

## Empfohlener Ablauf

1. Hotspots mit `list` oder Issues mit `issues:list` abrufen.
2. Kandidaten mit `show` oder `issues:show` im Detail prüfen.
3. Code und Tests anpassen.
4. Hotspots mit `review` oder `bulk-review` markieren.
5. Für normale Issues anschließend einen neuen Sonar-Scan abwarten oder bei berechtigter Ausnahme `issues:transition` bzw. `issues:comment` nutzen.

## Hinweise

- SonarCloud verlangt für Hotspot- und Issue-Abfragen in der Praxis Authentifizierung, auch wenn ein Projekt öffentlich sichtbar ist.
- Die verwendeten Hotspot-Endpunkte sind in SonarCloud weniger stabil dokumentiert als andere APIs. Bei Änderungen an der Plattform muss das Skript gegebenenfalls angepasst werden.
