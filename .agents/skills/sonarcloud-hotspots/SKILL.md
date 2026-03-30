---
name: sonarcloud-hotspots
description: Arbeite gezielt mit SonarCloud Security Hotspots und normalen Issues für `smart-village-app_sva-studio`. Nutze diesen Skill, wenn Befunde gelistet, geprüft, kommentiert oder statusseitig bearbeitet werden sollen.
---

# SonarCloud Hotspots und Issues

## Wann verwenden

Nutze diesen Skill, wenn die Aufgabe SonarCloud Security Hotspots oder normale Sonar-Issues betrifft, insbesondere:

- offene Hotspots im Projekt abrufen
- offene Issues im Projekt abrufen
- einen Hotspot auf Datei-, Regel- oder Branch-Ebene eingrenzen
- ein Issue auf Datei-, Regel-, Typ- oder Status-Ebene eingrenzen
- Hotspot-Details für eine technische Bewertung ansehen
- Befund-Details für eine technische Bewertung ansehen
- nach einem Fix den Status oder Kommentar in SonarCloud aktualisieren

## Standardwerkzeug

Verwende zuerst das Repo-CLI:

```bash
tsx scripts/ci/sonar-hotspots.ts --help
```

Das Skript unterstützt:

- `list`
- `show`
- `review`
- `bulk-review`
- `issues:list`
- `issues:show`
- `issues:transition`
- `issues:comment`

Es erwartet `SONAR_TOKEN` oder `SONARQUBE_TOKEN` in der Umgebung und nutzt standardmäßig das Projekt `smart-village-app_sva-studio`.

## Standardablauf

### 1. Offene Befunde abrufen

```bash
tsx scripts/ci/sonar-hotspots.ts list
tsx scripts/ci/sonar-hotspots.ts issues:list
```

Bei Bedarf weiter eingrenzen:

```bash
tsx scripts/ci/sonar-hotspots.ts list --branch main
tsx scripts/ci/sonar-hotspots.ts list --file-path-includes apps/sva-studio-react/src/components
tsx scripts/ci/sonar-hotspots.ts list --rule typescript:S5148
tsx scripts/ci/sonar-hotspots.ts list --csv
tsx scripts/ci/sonar-hotspots.ts issues:list --statuses OPEN,CONFIRMED --types BUG,VULNERABILITY
tsx scripts/ci/sonar-hotspots.ts issues:list --file-path-includes packages/sdk/src
```

### 2. Befund im Detail prüfen

```bash
tsx scripts/ci/sonar-hotspots.ts show --hotspot "$HOTSPOT_KEY"
tsx scripts/ci/sonar-hotspots.ts issues:show --issue "$ISSUE_KEY"
```

Prüfe dabei:

- betroffene Datei und Zeile
- Sonar-Regel
- vorhandene Gegenmaßnahmen im Code
- ob der Code tatsächlich angreifbar ist oder nur sicherheitsrelevant geprüft werden muss
- bei normalen Issues zusätzlich, ob der Befund durch neuen Scan verschwinden muss oder ob eine Sonar-Transition fachlich gerechtfertigt ist

### 3. Fix lokal validieren

Nach jeder Änderung die betroffenen Nx-Targets und Typprüfungen ausführen. Keine Hotspots in SonarCloud als erledigt markieren, bevor der lokale Stand grün ist.

### 4. Hotspot sauber markieren

Wenn der Code sicher ist oder der Fix abgeschlossen wurde:

```bash
tsx scripts/ci/sonar-hotspots.ts review \
  --hotspot "$HOTSPOT_KEY" \
  --resolution SAFE \
  --comment "Kurze, konkrete Begründung"
```

Für mehrere gleichartige Hotspots:

```bash
tsx scripts/ci/sonar-hotspots.ts bulk-review \
  --hotspot "$HOTSPOT_KEY_1" \
  --hotspot "$HOTSPOT_KEY_2" \
  --resolution SAFE \
  --comment "Gleiche technische Begründung"
```

### 5. Normale Issues bearbeiten

Kommentar ergänzen:

```bash
tsx scripts/ci/sonar-hotspots.ts issues:comment \
  --issue "$ISSUE_KEY" \
  --comment "Fix ist im aktuellen Branch umgesetzt"
```

Issue-Transition ausführen:

```bash
tsx scripts/ci/sonar-hotspots.ts issues:transition \
  --issue "$ISSUE_KEY" \
  --transition accept \
  --comment "Akzeptiert im konkreten Kontext"
```

## Guardrails

- Keine Hotspots pauschal als `SAFE` markieren.
- `bulk-review` nur verwenden, wenn dieselbe Begründung tatsächlich auf alle gewählten Hotspots passt.
- Normale Issues nur dann per Transition schließen oder akzeptieren, wenn ein neuer Scan den Befund nicht regulär auflösen soll oder die Ausnahme fachlich belastbar begründet ist.
- Die Begründung muss den konkreten Schutzmechanismus nennen, zum Beispiel Sanitizing, feste Allowlist, Origin-Prüfung oder fehlende externe Eingabe.
- Vor dem Markieren immer prüfen, ob der Sonar-Hinweis auf Testcode, Demo-Code oder produktiven Code zeigt.
- Bei Unsicherheit zuerst `show` oder `issues:show` nutzen und die lokale Stelle im Repo lesen.

## Referenz

Für Details zur Nutzung und Beispielbefehle siehe [docs/development/sonarcloud-security-hotspots.md](../../../docs/development/sonarcloud-security-hotspots.md).
