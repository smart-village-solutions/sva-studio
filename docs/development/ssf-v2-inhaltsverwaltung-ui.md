# SSF V2: Entwurf der Inhaltsverwaltung

**Stand:** Fachlich abgestimmter UI-Aufbau und Grundlage der Studio-Implementierung. Die V2-Endpunkte und Felder sind in den [Schemas für Installationsinhalte](../api/ssf-installation-content-v2.schema.json) und [Runtime-Konfiguration](../api/ssf-runtime-configuration-v2.schema.json) beschrieben.

## Ziel und Zuständigkeit

Die vorhandenen Plugin-Seiten bleiben die Einstiegspunkte: `System → SSF-Standards` für installationsweite Inhalte und die globale Vorlage, `Anwendungen → SSF-Konfiguration` für Abweichungen eines Mandanten. Die Systemseite bearbeitet auch Inhalte, die später in der mandantenbezogenen Runtime-Antwort erscheinen. Die Mandantenseite bearbeitet keine Installationsinhalte.

Die vorhandenen Aktionen für Lesen und Verwalten von System- beziehungsweise Mandantenkonfiguration bleiben getrennt. Die Mandantenseite bezieht ihren Mandanten aus dem geprüften Sitzungskontext; sie bietet keine freie Mandantenauswahl.

## Systemseite

Die Seite erhält zwei Hauptbereiche:

1. **Installation:** Logo und Icon, Impressum-, Datenschutz- und Barrierefreiheitslink, Sprache der Start- und Loginseite, deren Texte sowie das Feedbackformular auf diesen Seiten. Diese Werte gelten, bevor SSF einen Mandanten kennt.
2. **Vorlage für Mandanten:** Standardwerte für Branding, Mitarbeitendensprache, Dashboard, neues Gespräch, Gesprächsspeicherung mit Aufbewahrungsdauer, Gastsprachen und Feedback nach einem Gespräch. Änderungen an der Vorlage wirken auf alle Mandanten, die das betroffene Feld nicht überschreiben.

Innerhalb der Mandantenvorlage gliedern Abschnitte die Mitarbeitendenansicht, Gespräch und Speicherung, Gastsprachen sowie Feedback. Gastsprachen werden in Sprachreitern bearbeitet. Für jedes Feedbackformular gibt es eine übersichtliche Liste der fünf bekannten Fragen; die Textfelder einer Frage öffnen sich bei Bedarf.

## Mandantenseite und Vererbung

Die Mandantenseite verwendet dieselben Abschnitte der Mandantenvorlage. An jedem änderbaren Feld ist erkennbar, ob der Wert aus der Systemvorlage stammt oder lokal überschrieben wurde. „Systemstandard verwenden“ entfernt nur den Override dieses Feldes; der geerbte Wert bleibt sichtbar. Das gilt auch für Texte innerhalb einer Sprache und innerhalb einer Feedbackfrage. Die wirksame Gesprächsspeicherung berücksichtigt den geerbten oder überschriebenen Modus und die Aufbewahrungsdauer.

Ein leeres optionales Text- oder Zahlenfeld entfernt den geerbten Wert; ein ausdrücklich geleertes Bildfeld unterdrückt das geerbte Bild. Wird die Speicherung nach `disabled` wieder aktiviert, übernimmt der Editor zunächst die Speicherangaben der Systemvorlage. Fehlen dort Angaben für `ask`, müssen sie vor dem Speichern ergänzt werden.

Ein Mandant kann eine in der Systemvorlage angebotene Gastsprache aktivieren oder deaktivieren und ihre Texte einzeln überschreiben. Eine nicht angebotene Sprache kann er nicht selbst hinzufügen. Mandantenname und Zeitzone bleiben in der allgemeinen Instanzverwaltung.

## Feedback in der ersten UI-Version

Die UI zeigt nur `translationQuality`, `performance`, `usability`, `recommendation` und `improvementIdeas`. IDs, Fragetypen, Skalen und Reihenfolge sind fest. Bearbeitbar sind die sichtbaren Texte, die Pflichtangabe und beim Freitext Platzhalter und maximale Länge. Weitere Fragen können im V2-API-Vertrag vorkommen, werden aber erst nach einer eigenen UI-Erweiterung administrierbar. Die UI darf bestehende, ihr unbekannte Fragen beim Speichern nicht stillschweigend löschen.

Das installationsweite Feedbackformular und die Formulare für Mitarbeitende und Gäste sind getrennte Inhalte. Feedbackantworten werden auf dem SSF-Server gespeichert; Einlesen und Löschen im Studio gehört nicht zu dieser Oberfläche. Die Zuordnung von Feedback vor der Mandantenauswahl muss für die spätere Integration festgelegt werden.

## Bearbeiten, Prüfen und Speichern

Die vorhandenen Studio-Formularbausteine, Rich-Text-Editoren, Sprachreiter und Aktionen „Speichern“/„Verwerfen“ werden weiterverwendet. Der Entwurf bleibt beim Wechsel zwischen Bereichen erhalten. Nach erfolgreichem Speichern wird der bestätigte Stand angezeigt; Feldfehler und eine Zusammenfassung machen ungültige Eingaben erkennbar.

Server und UI prüfen Pflichtfelder, Feldlängen, HTTPS-URLs, die Grenzen der Aufbewahrungsdauer und die zulässigen Kombinationen von `ask`/`disabled` und `retentionHours`. Bei `disabled` ist die wirksame Dauer `null`, es wird keine Speicherfrage ausgeliefert. Bei `ask` stehen Dauer und lokalisierter Speicherhinweis unmittelbar nebeneinander. Ob die Aussage im freien HTML tatsächlich dieselbe Dauer und denselben Zweck nennt, erfordert eine redaktionelle Freigabe; eine automatische Textprüfung wäre nicht zuverlässig. Beispielwerte und Beispiel-URLs aus dem Vertrag werden nicht als produktiv freigegebene Inhalte übernommen.

Alle Eingabefelder erhalten sichtbare Beschriftungen; Reiter und Fragebereiche sind per Tastatur bedienbar. Fokus und Statusmeldungen folgen den bestehenden Studio-Formularmustern. HTML wird serverseitig erneut bereinigt; Berechtigungen und Mandantenbindung werden serverseitig geprüft.

## Separate consent and recording-release texts

The existing runtime editor manages optional `legalTexts` content: mode 2 consent, mode 3 consent, guest recording release, staff recording release, and recording status messages. Choice groups contain a heading, full rich-text body, and affirmative/negative labels. A group not supplied in a language remains `null`; German wording is not silently represented as a translation.

Source language and source version identify the original document. Legal languages are independent of guest languages, so German remains editable when it is the staff language. Add translations through the supported-language catalogue. Existing saved wording remains editable when the catalogue is unavailable. The system template defines available legal languages; tenant administrators override fields and reset them to the current template with the existing controls. Without a system legal template, a tenant can configure its own legal content.

The checkbox indicates only whether a text group is provided. It does not grant consent or authorize recording. Disabling storage retains legal content. Draft identifiers and unresolved placeholders such as `[Kontakt/Widerrufsmöglichkeit]` remain visible until finalized. Saving text is not legal approval.

The optional fields use the existing v2 response, HTML sanitizer, tenant scope, response-size limit, and content revision. Configurations without legal content remain valid. SSF conversation screens, recording control, and consent evidence require separate consumer implementation before the new groups can be used. The legacy `storageQuestionHtml` is not replaced automatically.

For a tenant-specific import, read and preserve the previous overrides, then merge `legalTexts` into them before writing through the existing tenant-content API. That API replaces the override document; sending only the new block would discard unrelated overrides. Verify saved content by reading it back. Before reverting to an image whose strict schema predates `legalTexts`, restore the pre-import JSON content first.

## Existing content acceptance checks

- Systemwerte erscheinen in der Installationsantwort oder als Vorlage in der Runtime-Antwort am passenden V2-Endpunkt.
- Ein einzelner Tenant-Override verändert nur sein Feld; Rücksetzen stellt die aktuelle Systemvorlage wieder her.
- Deaktivierte Speicherung liefert `mode=disabled`, `retentionHours=null` und keine Speicherfrage; ungültige Kombinationen werden abgewiesen.
- Ein Speichervorgang erhält unbekannte Feedbackfragen und andere nicht bearbeitbare Vertragsfelder.
- System- und Mandantenberechtigungen, fremde Mandanten, ungültiges HTML und ungültige URLs werden negativ geprüft.
- Die Redaktion prüft die konkreten Hinweise, Aufbewahrungswerte, Links und Übersetzungen vor produktiver Nutzung.
