## 1. Implementation

- [x] 1.0 `update-studio-swarm-migration-job`, `update-quantum-ops-decoupling`, `update-rollout-observability-gates` und `update-studio-rollout-network-consistency` als fachliche Voraussetzungen bestaetigen
- [x] 1.1 Kanonischen Gate-Pfad fuer prod-nahe Paritaetspruefung vor `studio`-Deploys festlegen
- [x] 1.2 Precheck-, Doctor- und Post-Deploy-Nachweise fuer Registry-/Auth-/RLS-Zustand aus Sicht von `APP_DB_USER` spezifizieren
- [x] 1.3 Kanonischen Reconcile-Pfad nach manuellen Portainer-/Quantum-Eingriffen oder Incident-Recovery definieren
- [x] 1.4 Runtime-Profil-Dokumentation um die explizite Vertragsgrenze zwischen lokalem Development und `studio` erweitern
- [x] 1.5 Abhaengigkeiten zu den vorausgesetzten Hardening-Changes abstimmen und auf reine Klammerlogik ohne doppelte Mechanik achten
- [x] 1.6 Betroffene arc42-Abschnitte unter `docs/architecture/` aktualisieren oder eine begruendete Abweichung dokumentieren
