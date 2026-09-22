## 1. Verträge und Persistenz

- [x] 1.1 Typisierten Vertrag für Individualvorlage, Revision und begrenzten Projektionsstatus in `@sva/core` ergänzen.
- [x] 1.2 Additive Migration für die optionale instanzbezogene Vorlage erstellen und beide kanonischen Schema-Dokumente aktualisieren.
- [x] 1.3 Repository-Reads und revisionsgebundene Writes inklusive Reset implementieren und gezielt testen.

## 2. Sichere Template-Kompilierung

- [x] 2.1 Server-only Validierung für Längen, erlaubte Platzhalter, genau einen Passwortlink, fehlendes Markup und freie URI-Schemata implementieren.
- [x] 2.2 Deterministische Kompilierung nach Keycloak-MessageFormat, Plaintext und escaped HTML implementieren.
- [x] 2.3 Positive, negative und Sonderzeichen-Tests für Compiler und Vorschau-Fiktion ergänzen.

## 3. Keycloak-Theme und Realm-Projektion

- [x] 3.1 `sva-kern2` um den E-Mail-Typ und den freigegebenen deutschen Standardtext erweitern.
- [x] 3.2 New-Realm-Baseline um `emailTheme = sva-kern2` samt Readback ergänzen, ohne Bestandsrealms automatisch zu mutieren.
- [x] 3.3 Bestehenden Keycloak-Admin-Adapter um eng begrenzte Read-, Write- und Delete-Operationen für Realm-Lokalisierung erweitern.
- [ ] 3.4 Instanzgebundene Projektion, exakten Readback, Driftklassifikation, Reset und idempotenten Retry implementieren und mit Teilfehlern testen.

## 4. Einladungspfad

- [x] 4.1 Create- und Resend-Pfad vor einer Custom-Einladung an den aktuellen Realm-Readback binden.
- [x] 4.2 Sicherstellen, dass Drift oder Keycloak-Ausfall nur die Einladung scheitern lässt und den bereits angelegten Account nicht zurückrollt.
- [ ] 4.3 Audit und Logs auf Revision/Fingerprint, Ergebnis und sichere Fehlercodes begrenzen.

## 5. Studio-Oberfläche

- [x] 5.1 Bestehende Instanzdetailseite um den autorisierten Vorlagendialog ohne neue Administrationsroute erweitern.
- [x] 5.2 Betreff, Nachricht, Linkbeschriftungen, Platzhalterhilfe, sichere Vorschau, Projektionszustand und Reset barrierefrei umsetzen.
- [x] 5.3 Deutsche und englische UI-Übersetzungen sowie gezielte Komponenten- und Interaktionstests ergänzen.

## 6. Architektur und Nachweise

- [x] 6.1 Arc42-Abschnitte 05, 06 und 08 um Ownership, Laufzeitfluss, Trust Boundary und Fehlerverhalten ergänzen.
- [x] 6.2 Server-Runtime-, Dateiablage- und passende gezielte Unit-/Integration-Gates ausführen.
- [ ] 6.3 Invarianten AIT-1 bis AIT-8 mit den vorgesehenen Nachweisen für den exakten HEAD belegen.
- [ ] 6.4 Testrealm-Abnahme für Standard, Individualvorlage, Reset und echten `UPDATE_PASSWORD`-Flow ohne persistierten Token durchführen.
