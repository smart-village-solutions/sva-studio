# Change: Instanz-Detailseite als klaren Arbeitsbereich entzerren

## Why
Die aktuelle Instanz-Detailseite unter `/admin/instances/:instanceId` zeigt Betriebsstatus, Tenant-IAM-Befunde, Workflow, Konfiguration, technische Diagnose und historische Protokolle gleichzeitig in einem langen Card-Stack. Dadurch werden aktueller Zustand, nächste sinnvolle Aktion und ältere technische Historie visuell gleich gewichtet.

Für Operatoren ist das besonders verwirrend, wenn eine Instanz formal betriebsbereit ist, gleichzeitig aber ältere fehlgeschlagene Provisioning-Läufe oder degradierte Tenant-IAM-Teilbefunde sichtbar sind. Die Seite braucht deshalb eine klarere Informationsarchitektur mit progressiver Offenlegung.

Die Zielseite soll nicht mehr wie ein Dokument mit vielen Cards funktionieren, sondern wie ein operatives Cockpit: zuerst aktueller Zustand, dann dominante Abweichungen, dann steuerbare Aktionen und erst danach tiefe Diagnose oder Historie.

## What Changes
- Die Instanz-Detailseite wird als `Control Tower + Workbench` modelliert: feste Uebersichtszonen fuer Lagebild und Entscheidungen, nachgelagerte Arbeitsbereiche fuer Konfiguration, Betrieb und Historie.
- Die Standardansicht priorisiert den aktuellen Betriebszustand, offene Hauptbefunde und genau eine primaere naechste Aktion.
- Die Uebersicht folgt Cockpit-Prinzipien wie `overview first`, `current truth over historical truth`, `state + freshness + provenance` und einer klaren Trennung zwischen Befund und Steuerung.
- Konfiguration, technische Diagnose und Historie werden vom Überblick getrennt statt gleichzeitig gleichrangig dargestellt.
- Historische fehlgeschlagene Runs bleiben verfuegbar, duerfen aber nicht mehr wie ein aktueller Gesamtblocker wirken.
- Bestehende Tenant-IAM-, Provisioning- und Keycloak-Evidenz bleibt erhalten, wird aber als Achsen, Drilldowns und nachgeordnete Evidenz klarer gruppiert und abgestuft angezeigt.
- Primaer- und Spezialaktionen werden klar getrennt, damit der Erstblick zu genau einer naechsten sinnvollen Handlung fuehrt.
- Die Oberflaeche darf gezielte optische Gimmicks wie subtile Status-Animationen, hochwertige Verdichtung von Farbe, Tiefe und Hover-Feedback enthalten, solange Lesbarkeit, Ruhe und Incident-Tauglichkeit gewahrt bleiben.

## Impact
- Affected specs: `account-ui`, `instance-provisioning`
- Affected code: `apps/sva-studio-react/src/routes/admin/instances/-instance-detail-page.tsx`, zugehörige Shared-Status-/Workflow-Helfer, i18n-Texte und Komponententests
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`
