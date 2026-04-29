## 1. Spezifikation
- [x] 1.1 Informationsarchitektur und Bedienprioritäten der Instanz-Detailseite in `account-ui` spezifizieren
- [x] 1.2 Trennung von aktuellem Strukturzustand und historischer Run-Evidenz in `instance-provisioning` spezifizieren

## 2. Umsetzung
- [x] 2.1 Ein kanonisches Cockpit-Modell fuer Gesamtzustand, Betriebsachsen, dominanten Befund und Primaeraktion aus bestehenden Datenquellen ableiten
- [x] 2.1 Detailseite in klar getrennte Arbeitsbereiche fuer Uebersicht, Konfiguration, Diagnose und Historie aufteilen
- [x] 2.2 Uebersicht als feste Kontrollzone mit Status, Evidenzfrische, Befundqueue und genau einer Primaeraktion umsetzen
- [x] 2.3 Primaer- und Sekundaeraktionen auf der Detailseite neu gewichten und gruppieren
- [x] 2.4 Historische Provisioning- und Diagnoseeintraege standardmaessig reduzieren und erst nach expliziter Oeffnung vertiefen
- [x] 2.5 Gezielte optische Gimmicks fuer Status, Feedback und Mikrointeraktion einbauen, ohne Lesbarkeit oder Accessibility zu verschlechtern
- [x] 2.6 UI- und Komponententests fuer die neue Informationsarchitektur und Statusdarstellung anpassen oder ergaenzen

## 3. Dokumentation und Qualitaet
- [x] 3.1 Relevante Architektur- und Bedienungsdoku fuer die neue Seitenstruktur aktualisieren oder die bewusste Abweichung dokumentieren
- [x] 3.2 Betroffene Unit-, Type- und gegebenenfalls E2E-Checks fuer die Detailseite ausfuehren
