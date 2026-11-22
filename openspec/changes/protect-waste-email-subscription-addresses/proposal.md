# Änderung: E-Mail-Adressen nach Abo-Ende entfernen und aktive Abos gezielt finden

## Warum

Bei der Abmeldung bleiben heute E-Mail-Adresse, Adresshash und Adresskopien in bereits erzeugten Nachrichten gespeichert. Eine unbestätigte Anmeldung wird nach Ablauf des Links noch bis zur zusätzlichen Aufbewahrungsgrenze gehalten. Der berechtigte Support kann anhand der maskierten Übersicht kein konkretes aktives Abo zu einer vom Bürger genannten Adresse finden.

Der JF hat entschieden, die Adresse einer unbestätigten Anmeldung beim ersten Bereinigungslauf nach Ablauf des Bestätigungslinks zu entfernen. Nach einer Abmeldung soll die Adresse ebenfalls aus den operativen Abo- und Versanddaten verschwinden. Die Adresssuche umfasst ausschließlich aktive Abos des berechtigten Mandanten.

## Was sich ändert

- Die gespeicherte Linkgültigkeit bestimmt, ab wann die Bereinigung einer unbestätigten Anmeldung fällig ist.
- Die Abmeldung beendet den Versand und entfernt Adressdaten aus Abo und Outbox. Der vorhandene Abmeldelink liefert bei Wiederholung weiterhin die Bestätigung.
- Das Monitoring erhält ein Suchformular für eine vollständige E-Mail-Adresse. Es verwendet die bestehende Monitoring-Berechtigung und zeigt maskierte aktive Treffer.
- Der erste Lieferabschnitt sichert Aktivierung, Versandfreigabe, Widerruf und Altbestandsbereinigung. Darauf baut die Suche auf.

## Auswirkungen und Grenzen

- Betroffene Spezifikationen sind `public-waste-calendar` und `waste-management`. Die Suchfunktion ergänzt den bestehenden Monitoring-Change `add-waste-email-monitoring`.
- Betroffen sind die Waste-Datenbank und -Runtime, die öffentlichen DOI-/Abmeldeaktionen, der Dispatch und das Studio-Monitoring. Der Zugriff auf Bestandsdaten in Maildiensten, Protokollarchiven oder Sicherungen erfordert eine eigene Entscheidung.
- Architekturbezug sind [Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [Laufzeitsicht](../../../docs/architecture/06-runtime-view.md) und [Querschnittskonzepte](../../../docs/architecture/08-cross-cutting-concepts.md).

## Freigabeentscheidung

Ein bereits an den Versanddienst übergebener Auftrag kann noch im Postfach ankommen. Nach erfolgreicher Abmeldung beginnt keine neue Übergabe für dieses Abo. Eine erfolgreich gestartete, noch laufende Übergabe und die Abmeldung werden bis zum Ablauf des begrenzten Versandversuchs serialisiert. Die Bereinigung produktiver Altdaten erhält einen eigenen Ausführungsauftrag mit Umfang und Rückleseprüfung.
