## 1. Verträge und Persistenz

- [x] 1.1 Typisierten Vertrag für Individualvorlage, Servervorlage, Revision und wirksame Quelle in `@sva/core` ergänzen.
- [x] 1.2 Additive Migration für die optionale instanzbezogene Vorlage erstellen und beide kanonischen Schema-Dokumente aktualisieren.
- [x] 1.3 Repository-Reads und revisionsgebundene Writes inklusive Reset implementieren und gezielt testen.
- [x] 1.4 Typisierte, revisionsgebundene Servervorlage mit stabilem Schlüssel `account_invitation` additiv persistieren und in beiden Schema-Dokumenten abbilden.
- [x] 1.5 Wirksame Vorlage als Instanzvorlage -> Servervorlage -> SVA-Standard auflösen, ohne Servertexte in Instanzdatensätze zu kopieren.

## 2. Sichere Template-Kompilierung

- [x] 2.1 Server-only Validierung für Längen, erlaubte Platzhalter, genau einen Passwortlink, fehlendes Markup und freie URI-Schemata implementieren.
- [x] 2.2 Deterministische Kompilierung nach Keycloak-MessageFormat, Plaintext und escaped HTML implementieren.
- [x] 2.3 Positive, negative und Sonderzeichen-Tests für Compiler und Vorschau-Fiktion ergänzen.

## 3. Keycloak-Theme und Realm-Projektion

- [x] 3.1 `sva-kern2` um den E-Mail-Typ und den freigegebenen deutschen Standardtext erweitern.
- [x] 3.2 New-Realm-Baseline um `emailTheme = sva-kern2` samt Readback ergänzen, ohne Bestandsrealms automatisch zu mutieren.
- [x] 3.3 Bestehenden Keycloak-Admin-Adapter um eng begrenzte Read-, Write- und Delete-Operationen für Realm-Lokalisierung erweitern.
- [x] 3.4 Den bestehenden Readback vor Create und Resend zu einer bedarfsgesteuerten, idempotenten Sicherstellung der drei Realmwerte erweitern.
- [x] 3.5 Speichern und Reset von Server- und Instanzvorlagen von jedem Keycloak-Write entkoppeln; globale Projektionsstatus und explizite Projektions-Retries entfernen.

## 4. Einladungspfad

- [x] 4.1 Create- und Resend-Pfad vor einer Custom-Einladung an den aktuellen Realm-Readback binden.
- [x] 4.2 Sicherstellen, dass Drift oder Keycloak-Ausfall nur die Einladung scheitern lässt und den bereits angelegten Account nicht zurückrollt.
- [x] 4.3 Audit und Logs auf Revision/Fingerprint, Ergebnis und sichere Fehlercodes begrenzen.
- [x] 4.4 Create und Resend mit Instanz-, Server- und SVA-Quelle sowie Write-/Readbackfehlern gezielt testen.

## 5. Studio-Oberfläche

- [x] 5.1 Bestehende Instanzdetailseite um den autorisierten Vorlagendialog ohne neue Administrationsroute erweitern.
- [x] 5.2 Betreff, Nachricht, Linkbeschriftungen, Platzhalterhilfe, sichere Vorschau, wirksame Quelle und Reset barrierefrei umsetzen.
- [x] 5.3 Deutsche und englische UI-Übersetzungen sowie gezielte Komponenten- und Interaktionstests ergänzen.
- [x] 5.4 Unter `System -> Templates` die autorisierte Seite mit genau dem Eintrag „Account-Einladung“ ergänzen und vorhandene Editorlogik wiederverwenden.
- [x] 5.5 In Server- und Instanzansicht die wirksame Quelle anzeigen; Instanz-Reset als Rückkehr zur Serververerbung formulieren und Projektionsstatus entfernen.

## 6. Architektur und Nachweise

- [x] 6.1 Arc42-Abschnitte 05, 06 und 08 um Ownership, Laufzeitfluss, Trust Boundary und Fehlerverhalten ergänzen.
- [x] 6.2 Server-Runtime-, Dateiablage- und passende gezielte Unit-/Integration-Gates ausführen.
- [x] 6.3 Invarianten AIT-1 bis AIT-9 mit den vorgesehenen Nachweisen für den exakten HEAD belegen.
- [ ] 6.4 Testrealm-Abnahme für Standard, Individualvorlage, Reset und echten `UPDATE_PASSWORD`-Flow ohne persistierten Token durchführen.
- [ ] 6.5 Testrealm-Abnahme um Serververerbung und bedarfsgesteuerte Aktualisierung beim nächsten Versand erweitern.
- [x] 6.6 Arc42-Abschnitte 05, 06 und 08 auf Serververerbung und bedarfsgesteuerte Sicherstellung aktualisieren.
