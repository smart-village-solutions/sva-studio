## 1. Spezifikation und Runtime-Vertrag

- [ ] 1.1 OpenSpec-Deltas für isolierten Releasepfad, Stack-Trennung und Dokumentationspflicht ergänzen
- [ ] 1.2 Produktionskonfiguration der öffentlichen Waste-Web-App auf einzelne `PUBLIC_WASTE_*`-Variablen umstellen und `PUBLIC_WASTE_CONFIG_JSON` nur als Fallback erhalten
- [ ] 1.3 Produktionsruntime mit Health-Endpoint und bestehenden `/api/public-waste/*`-Handlern implementieren

## 2. Deployment-Artefakte

- [ ] 2.1 Eigenes Dockerfile und eigene Swarm-Compose-Datei für `public-waste-calendar` ergänzen
- [ ] 2.2 Quantum-/Runtime-Beispielkonfiguration für den isolierten Waste-Web-Stack dokumentieren
- [ ] 2.3 GitHub-Workflow für Git-Tags `waste-web-vX.Y.Z` ergänzen, der nur das Waste-Web-Image baut und den Waste-Web-Stack ausrollt
- [ ] 2.4 Dedizierten Portainer-/Quantum-Scriptpfad ergänzen, der nur `PUBLIC_WASTE_IMAGE_TAG` im Zielstack aktualisiert

## 3. Verifikation und Dokumentation

- [ ] 3.1 Fokus-Tests, Typechecks, Compose-Render und OpenSpec-Validierung grün ziehen
- [ ] 3.2 arc42-Abschnitte `05`, `07` und `08` sowie Deploy-Guide/Runbook für den isolierten Waste-Web-Releasepfad fortschreiben
