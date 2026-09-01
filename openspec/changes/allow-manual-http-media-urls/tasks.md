## 1. Gemeinsamer URL-Vertrag

- [x] 1.1 Getrennte typsichere Validierung für manuelle HTTP-/HTTPS-Medien-URLs ergänzen, ohne den HTTPS-only-Asset-Vertrag zu lockern
- [x] 1.2 Normalisierung und race-sichere Browser-Bildprobe nach abgeschlossener Eingabe implementieren
- [x] 1.3 Zugängliche Erfolgs-, Warn- und Fehlermeldungen im gemeinsamen Medienblock ergänzen

## 2. Plugin-Persistenz

- [x] 2.1 POI-, News-, Events-, Generic-Items-, Projects- und Cockpit-Cards-Adapter nur für manuelle Verwendungen auf den erweiterten Vertrag umstellen
- [x] 2.2 Sicherstellen, dass korrigierte Werte bestehende Formularfehler unmittelbar auflösen und HTTP-Warnungen das Speichern nicht blockieren

## 3. Tests und Dokumentation

- [x] 3.1 Unit- und Komponententests für Normalisierung, HTTPS-Upgrade, HTTP-Fallback, Warnung, ungültige URLs und Race-Schutz ergänzen
- [x] 3.2 Den POI-Akzeptanzfall aus Issue #1084 mit der Pixelpoint-URL abdecken
- [x] 3.3 `docs/development/plugin-development.md` um die getrennten manuellen und Asset-URL-Verträge ergänzen
- [x] 3.4 Kleinste relevante Nx-Unit- und Type-Gates ausführen
