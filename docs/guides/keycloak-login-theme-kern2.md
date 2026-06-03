# Keycloak-Login-Theme `sva-kern2`

## Ziel

Dieses Dokument beschreibt das im Repository hinterlegte Keycloak-Login-Theme `sva-kern2` für das SVA Studio.

Das Theme orientiert sich an der bestehenden KERN-2-nahen Studio-Shell:

- Fira Sans als Primärschrift
- KERN-nahe Blau-Grau-Palette
- reduzierte Radien
- helle Glas-/Panel-Flächen mit klarer Fokus- und Hover-Sprache
- Dark-Mode-Fallback über `prefers-color-scheme`

Das Theme erweitert bewusst `keycloak.v2`, statt komplette Keycloak-Templates zu forken.
Dadurch bleibt der Upgrade-Aufwand gegenüber einem vollständigen Login-Template-Override kleiner.

## Ablage im Repository

Das Theme-Bundle liegt unter:

- `deploy/keycloak/themes/sva-kern2/`

Wesentliche Dateien:

- `META-INF/keycloak-themes.json`
- `theme/sva-kern2/login/theme.properties`
- `theme/sva-kern2/login/resources/css/kern2.css`
- `theme/sva-kern2/login/footer.ftl`

## Theme-Name in Keycloak

In den Realm-Einstellungen ist als `Login Theme` der Name

- `sva-kern2`

zu setzen.

## Deployment

### Variante A: als Archiv-JAR

Für produktive Umgebungen ist ein versioniertes Archiv der bevorzugte Pfad.

Beispiel:

```bash
cd deploy/keycloak/themes/sva-kern2
jar cf sva-kern2.jar META-INF theme
```

Danach:

1. `sva-kern2.jar` in das Keycloak-Verzeichnis `providers/` kopieren
2. Keycloak neu starten
3. im Ziel-Realm unter `Realm Settings -> Themes -> Login Theme` den Wert `sva-kern2` wählen

### Variante B: als entpacktes Theme-Verzeichnis

Für lokale Iteration kann das Theme direkt in das Keycloak-Verzeichnis `themes/` entpackt oder kopiert werden.

Das Ziel auf dem Server ist dann typischerweise:

```text
themes/sva-kern2/login/...
```

## Caching-Hinweise

Bei Theme-Änderungen kann Keycloak alte Artefakte cachen.
Für lokale oder operative Fehlersuche:

1. Theme neu deployen
2. Keycloak neu starten
3. bei Bedarf den Theme-Cache von Keycloak leeren

## Gestaltungsprinzipien

Das Theme folgt folgenden Regeln:

- keine vollständige Neustrukturierung des Keycloak-Login-Markups
- visuelle Anpassung primär über CSS
- Fokus auf Login, Eingabefelder, Buttons, Alerts und Footer
- keine projektspezifischen Geheimnisse, URLs oder tenant-spezifischen Texte im Theme selbst

## Tenant-Nutzung

Das Theme ist generisch und kann mehreren Tenant-Realms zugewiesen werden.
Wenn später tenant-spezifische Varianten benötigt werden, gibt es zwei saubere Ausbaupfade:

1. mehrere Theme-Namen wie `sva-kern2-guben` oder `sva-kern2-forest`
2. ein gemeinsames Basistheme mit abgeleiteten Varianten

Für den aktuellen Stand ist `sva-kern2` die empfohlene Standardvariante.
