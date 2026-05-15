# Change: Realm-modusspezifische Instanz-Detailseite

## Why
Die Instanz-Detailseite vermischt aktuell den Aufbaupfad für neue Realms mit dem Abgleichs- und Driftpfad für Bestands-Realms. Dadurch erscheinen auf dem `new`-Pfad erwartbare, noch nicht erzeugte Keycloak-Artefakte als aktuelle Blocker, die Reihenfolge der Operator-Schritte bleibt unklar und Erfolg bzw. Misserfolg einzelner Schritte ist über mehrere Bereiche verteilt.

## What Changes
- Die Detailseite unterscheidet explizit zwischen `realmMode = new` und `realmMode = existing`.
- Die gemeinsame Detail-Shell bleibt erhalten, der operative Mittelteil wird pro Realm-Modus separat aufgebaut.
- Für `new` wird ein linearer Aufbau-Workflow mit klarer Schrittfolge, Primäraktion und Fortschrittsstatus eingeführt.
- Für `existing` wird ein Diagnose-/Reconcile-Workflow mit Drift-, Prüf- und Reparaturfokus eingeführt.
- Konfigurations- und Betriebsbewertung werden mode-aware: erwartbar noch fehlende Artefakte im `new`-Pfad werden nicht als aktuelle Defekte dargestellt.
- Historie und aktuelle Evidenz werden klarer getrennt, damit alte Fehl-Läufe den Erstblick nicht dominieren.
- Der `new`-Pfad endet fachlich beim erfolgreichen Realm-Grundaufbau; nachgelagerte Tenant-IAM- oder Modul-IAM-Folgeschritte werden sichtbar abgegrenzt, aber nicht in denselben Kernworkflow vermischt.
- Die Primäraktion wird über eine feste, testbare Prioritätsregel aus Konfiguration, Preflight, Plan, Run-Status, Secret-Sync und Abschlussvalidierung abgeleitet.
- Die spätere Umsetzung dieses Changes muss die bestehenden Coverage- und Complexity-Gates des Repositories einhalten; notwendige Tests und Refactorings sind Teil des Scopes.

## Impact
- Affected specs: `account-ui`, `instance-provisioning`
- Affected code: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.tsx`, `apps/sva-studio-react/src/routes/admin/instances/-instances-shared.tsx`, zugehörige Tests und i18n-Ressourcen
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
