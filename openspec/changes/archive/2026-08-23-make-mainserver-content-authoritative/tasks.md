## 1. Spezifikation und Architektur

- [x] 1.1 Mainserver-authoritative Read-, Write-, IAM- und History-Verträge spezifizieren
- [x] 1.2 Arc42- und Content-Management-Dokumentation aktualisieren

## 2. Mainserver-authoritative Projekte

- [x] 2.1 Projektmodell ohne verpflichtenden lokalen Content-Core aus Mainserver-Feldern ableiten
- [x] 2.2 Liste und Detail direkt aus `FeaturedProject`-GenericItems liefern
- [x] 2.3 Bestehende lokale IDs optional über External References auflösen
- [x] 2.4 Update und Soft-Delete für externe Mainserver-Projekte ohne lokalen Core ermöglichen
- [x] 2.5 Lokale Folgefehler nach erfolgreichem Provider-Write nicht destruktiv behandeln

## 3. Plattformkonsistenz

- [x] 3.1 Gemeinsame Listenprojektion als rekonstruierbaren Cache verifizieren
- [x] 3.2 History-Coverage für extern erzeugte Inhalte explizit testen und dokumentieren

## 4. Qualität

- [x] 4.1 Regressions-, Typ- und relevante Runtime-Tests ausführen
- [x] 4.2 OpenSpec strikt validieren und Aufgabenstatus synchronisieren
