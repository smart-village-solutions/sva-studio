# Keycloak-Login-Theme `sva-kern2`

## Ziel

Dieses Dokument beschreibt das im Repository hinterlegte Keycloak-Login-Theme `sva-kern2` für das SVA Studio.

Das Theme orientiert sich an der bestehenden KERN-2-nahen Studio-Shell:

- Fira Sans als Primärschrift
- KERN-nahe Blau-Grau-Palette
- reduzierte Radien
- kontrastreiche Panel-Flächen mit klarer Fokus- und Hover-Sprache
- automatische Light-/Dark-Auswahl über die Browser- und Betriebssystem-Präferenz `prefers-color-scheme`

Light ist der Fallback, wenn ein Browser keine Farbschema-Präferenz bereitstellt. Das Theme wird als einzelnes Login-Theme ausgeliefert; separate Realm-Themes für Light und Dark sind nicht erforderlich.

Das Theme erweitert `keycloak.v2`. Nur `login.ftl` ist auf Basis von Keycloak 26.8.1
(Apache-2.0) überschrieben: Organisationsanbieter stehen vor dem lokalen Formular,
auch in der DOM- und Tastaturreihenfolge. Formular-, Anbieter- und Passkey-Makros
bleiben geerbt. Bei Keycloak-Upgrades muss dieser kleine Override mit dem
Upstream-Template abgeglichen werden.

## Ablage im Repository

Das Theme-Bundle liegt unter:

- `deploy/keycloak/themes/sva-kern2/`

Wesentliche Dateien:

- `META-INF/keycloak-themes.json`
- `theme/sva-kern2/login/theme.properties`
- `theme/sva-kern2/login/resources/css/kern2.css`
- `theme/sva-kern2/login/footer.ftl`
- `theme/sva-kern2/login/login.ftl`
- `theme/sva-kern2/login/messages/messages_{de,en}.properties`
- `theme/sva-kern2/email/theme.properties`
- `theme/sva-kern2/email/messages/messages_de.properties`

## E-Mail-Bestätigung

Der E-Mail-Teil erbt von `base`. Die deutschen `emailVerification*`-Texte
bestätigen neutral die Adresse, sowohl bei Registrierung als auch bei einer
Adressänderung. `{2}` wird durch den Realm-Anzeigenamen ersetzt. Der Main-Server
verwendet dafür in seiner bestehenden Bestätigungsmethode `send-verify-email`;
die bearbeitbaren Einladungstexte unter `executeActions*` bleiben getrennt.
Die Bestätigungstexte verwenden `{0}` für den Link und `{3}` für die formatierte
Gültigkeitsdauer; bei den Einladungstexten ist Letztere dagegen `{4}`.

Vor einer Freigabe den E-Mail-Teil des Themes auf dem Zielserver und die
effektiven deutschen Texte prüfen. Eine Realm-Zuweisung allein bestätigt nicht,
dass das Theme dort verfügbar ist. Der sichtbare Absendername steht realmweit
unter `Realm Settings -> Email -> From display name`; für kommunale Realms ist
der Kommunenname vorgesehen. Die bestehende Versandadresse bleibt erhalten.

### Bearbeitung im Studio

Auf dem Root-Host ist unter `/admin/templates` die allgemeine Bestätigungsvorlage
bearbeitbar. Sie gilt für alle Instanzen ohne Override. An der Instanz steht neben der Account-Einladung
„E-Mail-Adresse bestätigen“ bereit. Plattformadministratoren lesen hier die
wirksamen deutschen Theme-/Realm-Texte und bearbeiten Betreff und Nachricht.
Der Bestätigungslink `{{verificationLink}}` muss genau einmal vorkommen;
`{{tenantName}}` und `{{linkExpiresIn}}` sind optional. Im Betreff sind keine
Platzhalter erlaubt. HTML und freie URLs werden abgewiesen.

Speichern und Reset persistieren zuerst die Quelle
in `iam.instance_mail_templates` beziehungsweise im allgemeinen Vorlagenbestand; anschließend werden die drei `emailVerification*`-
Schlüssel übertragen und zurückgelesen. „Allgemeine Vorlage verwenden“ entfernt nur den Instanz-Override. Änderungen des
allgemeinen Standards gleichen nur erbende Instanzen ab; eigene Overrides bleiben
erhalten. Ein Reset des allgemeinen Standards verwendet wieder den neutralen
eingebauten Text. Die Einladung verwendet denselben
Speicher-/Abgleichpfad mit `executeActions*`. Ein Fehler verliert den gespeicherten
Studio-Stand nicht. Öffnen zeigt den Vergleich mit den wirksamen deutschen
Theme-/Realm-Werten, einschließlich externer Änderungen.

„Keycloak-Stand übernehmen“ und „Studio-Stand übertragen“ sind ausdrücklich
bestätigte Aktionen mit Quellrevision und erneut geprüften Vergleichssnapshots.
Fremde HTML-Layouts bleiben als Quelltext sichtbar; eine Übernahme ist nur möglich,
wenn der Texteditor die vollständige Fassung verlustfrei wieder erzeugen kann.
Die Snapshot-Prüfung ist keine atomare Keycloak-CAS-Garantie. Beim Versand wird nur
verglichen und bei Abweichungen blockiert, niemals das Theme oder Texte geändert.
SMTP und die bereits gepflegten Absendernamen bleiben unverändert. Die API steht
in [iam-v1.yaml](../api/iam-v1.yaml).

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

- Organisationsanmeldung oberhalb des lokalen Formulars, mit erklärendem Text und eigener Trennlinie
- Anbietername und vorhandene Anbietericons aus der Realm-Konfiguration; keine eingebauten Tenant-Namen
- deutsche und englische Texte über Keycloaks `msg(...)` und `messages_*.properties`
- einzeilige Eingabefelder und Sprachwahl mit 44 px Höhe und vertikal zentrierten Controls
- versionierte Stylesheet-Referenz; bei CSS-Änderungen Versionskennung in `theme.properties` erhöhen
- deutlich erkennbare Anbieterbuttons mit mindestens 48 px Höhe und eigenem Tastaturfokus
- genau ein Fokusindikator am Feldcontainer; innere Felder und PatternFly-Pseudoelemente zeichnen keinen weiteren Rahmen
- Fehlerzustände behalten den roten Feldrand; Autofill und Passwortmanager werden nicht deaktiviert
- visuelle Anpassung primär über CSS
- Fokus auf Login, Eingabefelder, Buttons, Alerts und Footer
- explizite Farben für Autofill, Platzhalter, Fokusindikatoren und den Passwort-Schalter in beiden Modi
- Textkontrast von mindestens 4,5:1 und Kontrast relevanter UI-Grenzen von mindestens 3:1
- keine projektspezifischen Geheimnisse, URLs oder tenant-spezifischen Texte im Theme selbst

## Tenant-Nutzung

Das Theme ist generisch und kann mehreren Tenant-Realms zugewiesen werden.
Wenn später tenant-spezifische Varianten benötigt werden, gibt es zwei saubere Ausbaupfade:

1. mehrere Theme-Namen wie `sva-kern2-guben` oder `sva-kern2-forest`
2. ein gemeinsames Basistheme mit abgeleiteten Varianten

Für den aktuellen Stand ist `sva-kern2` die empfohlene Standardvariante.
