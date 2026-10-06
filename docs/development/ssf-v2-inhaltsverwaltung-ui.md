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

Ein Mandant kann eine in der Systemvorlage angebotene Gastsprache aktivieren oder deaktivieren und ihre Texte einzeln überschreiben. Eine nicht angebotene Sprache kann er nicht selbst hinzufügen. Mandantenname und Zeitzone bleiben in der allgemeinen Instanzverwaltung.

## Feedback in der ersten UI-Version

Die UI zeigt nur `translationQuality`, `performance`, `usability`, `recommendation` und `improvementIdeas`. IDs, Fragetypen, Skalen und Reihenfolge sind fest. Bearbeitbar sind die sichtbaren Texte, die Pflichtangabe und beim Freitext Platzhalter und maximale Länge. Weitere Fragen können im V2-API-Vertrag vorkommen, werden aber erst nach einer eigenen UI-Erweiterung administrierbar. Die UI darf bestehende, ihr unbekannte Fragen beim Speichern nicht stillschweigend löschen.

Das installationsweite Feedbackformular und die Formulare für Mitarbeitende und Gäste sind getrennte Inhalte. Feedbackantworten werden auf dem SSF-Server gespeichert; Einlesen und Löschen im Studio gehört nicht zu dieser Oberfläche. Die Zuordnung von Feedback vor der Mandantenauswahl muss für die spätere Integration festgelegt werden.

## Bearbeiten, Prüfen und Speichern

Die vorhandenen Studio-Formularbausteine, Rich-Text-Editoren, Sprachreiter und Aktionen „Speichern“/„Verwerfen“ werden weiterverwendet. Der Entwurf bleibt beim Wechsel zwischen Bereichen erhalten. Nach erfolgreichem Speichern wird der bestätigte Stand angezeigt; Feldfehler und eine Zusammenfassung machen ungültige Eingaben erkennbar.

Server und UI prüfen Pflichtfelder, Feldlängen, HTTPS-URLs, die Grenzen der Aufbewahrungsdauer und die zulässigen Kombinationen von `ask`/`disabled` und `retentionHours`. Bei `disabled` ist die wirksame Dauer `null`, es wird keine Speicherfrage ausgeliefert. Bei `ask` stehen Dauer und lokalisierter Speicherhinweis unmittelbar nebeneinander. Ob die Aussage im freien HTML tatsächlich dieselbe Dauer und denselben Zweck nennt, erfordert eine redaktionelle Freigabe; eine automatische Textprüfung wäre nicht zuverlässig. Beispielwerte und Beispiel-URLs aus dem Vertrag werden nicht als produktiv freigegebene Inhalte übernommen.

Alle Eingabefelder erhalten sichtbare Beschriftungen; Reiter und Fragebereiche sind per Tastatur bedienbar. Fokus und Statusmeldungen folgen den bestehenden Studio-Formularmustern. HTML wird serverseitig erneut bereinigt; Berechtigungen und Mandantenbindung werden serverseitig geprüft.

## Nachweis vor Freigabe

- Systemwerte erscheinen in der Installationsantwort oder als Vorlage in der Runtime-Antwort am passenden V2-Endpunkt.
- Ein einzelner Tenant-Override verändert nur sein Feld; Rücksetzen stellt die aktuelle Systemvorlage wieder her.
- Deaktivierte Speicherung liefert `mode=disabled`, `retentionHours=null` und keine Speicherfrage; ungültige Kombinationen werden abgewiesen.
- Ein Speichervorgang erhält unbekannte Feedbackfragen und andere nicht bearbeitbare Vertragsfelder.
- System- und Mandantenberechtigungen, fremde Mandanten, ungültiges HTML und ungültige URLs werden negativ geprüft.
- Die Redaktion prüft die konkreten Hinweise, Aufbewahrungswerte, Links und Übersetzungen vor produktiver Nutzung.
