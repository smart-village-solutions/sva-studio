## Context

Die bestehende Instanzdiagnostik beschreibt vor allem Provisioning- und Registry-Verträge. Reale Tenant-IAM-Fehler entstehen jedoch auch dann, wenn Realm, Clients und Secrets formal vorhanden sind, der tenantlokale Admin-Client aber operativ nicht arbeiten kann oder der Reconcile-Pfad einen Backlog mit stabilen Fehlercodes führt.

Das führt zu einer Lücke zwischen:

- struktureller Readiness: Realm, Client, Secret, Mapper, Tenant-Admin-User vorhanden
- operativer Readiness: Tenant-Admin-Client kann die für IAM nötigen Operationen wirklich ausführen

## Goals / Non-Goals

- Goals:
  - Tenant-IAM auf der Instanz-Detailseite als eigenen Betriebszustand sichtbar machen
  - Konfigurationsdrift, Rechteprobleme und Reconcile-Backlog getrennt darstellen
  - vorhandene sinnvolle Operator-Aktionen im Detailkontext bündeln
  - tenantlokalen Reconcile-Pfad auf den korrekten Keycloak-Client festlegen
- Non-Goals:
  - keine Ampel oder Aggregation in der Instanzliste
  - keine vollständige neue IAM-Control-Plane außerhalb der Detailseite
  - kein generischer Self-Healing-Orchestrator für beliebige Tenant-IAM-Fehler

## Decisions

- Decision: Die Instanz-Detailseite erhält einen eigenen `tenantIamStatus` statt die vorhandene `keycloakStatus`-Checkliste zu überladen.
  - Rationale: `keycloakStatus` beschreibt Struktur- und Provisioning-Artefakte. `tenantIamStatus` beschreibt Betriebsfähigkeit, Rechteprobe und Reconcile-Zustand. Diese Trennung verhindert irreführend "grüne" Strukturzustände bei operativ kaputtem Tenant-IAM.

- Decision: `tenantIamStatus` wird in vier Teilachsen modelliert:
  - `configuration`: Registry-/Provisioning-Vertrag
  - `access`: tenantlokale Admin-Rechteprobe
  - `reconcile`: letzter bekannte Sync-/Reconcile-Zustand
  - `overall`: zusammengefasster Betriebszustand für die Detailseite
  - Rationale: Operatoren müssen erkennen können, ob ein Fehler auf fehlende Konfiguration, fehlende Rechte oder auf Abgleichsbacklog zurückgeht.

- Decision: Es werden nur vorhandene sinnvolle Bestandsaktionen integriert; neue Mutationen kommen nur für die Rechteprobe hinzu.
  - Rationale: Der Change soll operativ nützlich bleiben, ohne durch viele neue Repair-Endpunkte unnötig teuer zu werden.

- Decision: Die tenantlokale Rechteprobe bleibt explizit und wird nicht automatisch bei jedem Laden der Detailseite ausgeführt.
  - Rationale: Die Probe verursacht zusätzliche Keycloak-Last und verlängert den Seitenaufbau. Für den ersten Ausbauschritt reicht es, den letzten bekannten Probe-Befund anzuzeigen und eine gezielte Operator-Aktion anzubieten.

- Decision: Normale Tenant-Reconcile-Ausführungen verwenden ausschließlich den tenantlokalen Admin-Client.
  - Rationale: Das ist bereits fachlicher Soll-Zustand und muss als Defektkorrektur Teil desselben Changes sein, damit die neue Statussicht auf dem korrekten Ausführungspfad aufsetzt.

- Decision: Der erste Ausbauschritt aggregiert bevorzugt vorhandene Evidenz aus Registry, Keycloak-Provisioning-Artefakten und bestehendem Reconcile-Zustand.
  - Rationale: Damit entsteht operativer Nutzen ohne sofort neue dauerhafte Diagnose- oder Historientabellen einzuführen. Zusätzliche Persistenz für Probe-Snapshots ist nur gerechtfertigt, wenn die vorhandene Evidenz nicht ausreicht.

## Risks / Trade-offs

- Risiko: Zusätzliche Statusabfragen können die Detailseite komplexer und langsamer machen.
  - Mitigation: `tenantIamStatus` als klaren, kompakten Aggregatvertrag liefern; keine Vielzahl unkoordinierter Einzel-Calls im UI und keine automatische Rechteprobe beim Seitenaufruf.

- Risiko: Bestandsaktionen werden als "Fix all"-Mechanismus missverstanden.
  - Mitigation: Jede Aktion bleibt einer klaren Statusachse und Diagnoseempfehlung zugeordnet; keine unspezifische globale Reparaturaktion.

- Risiko: Reconcile- und Probe-Signale divergieren zeitlich.
  - Mitigation: Zeitstempel, `requestId` und Statusquelle explizit im Vertrag ausweisen.

## Migration Plan

1. Vertrag für `tenantIamStatus` im Core ergänzen.
2. Instanz-Detail-Backend aggregiert Strukturstatus, Access-Probe und Reconcile-Evidenz.
3. Tenant-Reconcile auf tenantlokalen Admin-Client umstellen.
4. Instanz-Detailseite rendert Tenant-IAM-Block und verknüpft passende Aktionen.
5. Tests und Doku auf neue Diagnose- und Betriebslogik erweitern.

## Contract Outline

- `tenantIamStatus` ist ein Aggregat im Instanz-Detailvertrag, kein eigener Listen- oder Polling-Vertrag.
- Minimale Form:
  - `configuration`, `access`, `reconcile`, `overall`
  - jede Achse enthält mindestens `status`, `summary`, `checkedAt?`, `errorCode?`, `requestId?`, `source`
- zulässige `status`-Werte pro Achse:
  - `ready`
  - `degraded`
  - `blocked`
  - `unknown`
- `source` kennzeichnet die Herkunft des Befunds und ist auf bekannte Werte begrenzt:
  - `registry`
  - `keycloak_status_snapshot`
  - `keycloak_provisioning_run`
  - `role_reconcile`
  - `access_probe`
- `overall` ist eine reine Ableitung und darf keine zusätzliche exklusive Diagnosequelle einführen.

## Access-Probe API

- Die explizite Rechteprobe wird als instanzbezogene Operator-Aktion modelliert.
- Vorgesehener Write-Pfad:
  - `POST /api/v1/iam/instances/:instanceId/tenant-iam/access-probe`
- Der Endpoint ist nicht destruktiv und liefert den aktualisierten `access`-Befund sowie den daraus neu berechneten `overall`-Befund zurück.
- Die Probe darf nur tenantlokale Keycloak-Lese-/Prüfoperationen verwenden, die keine Rollen-, User- oder Gruppenmutation auslösen.
- Wenn keine neue Probe ausgeführt wurde, verwendet die Detailansicht nur vorhandene Evidenz und markiert den Befund über `source` nachvollziehbar.

## Evidence Rules

- `configuration` wird aus Registry- und bestehenden Keycloak-Strukturartefakten abgeleitet.
- `reconcile` wird aus vorhandenem Rollen-/User-Reconcile-Zustand und korrelierbarer Fehlerdiagnose abgeleitet.
- `access` stammt entweder aus einer expliziten Rechteprobe oder bleibt `unknown`, wenn noch keine belastbare Access-Evidenz vorliegt.
- Neue Persistenz für Probe-Snapshots ist optional; die Spezifikation verlangt nur einen stabilen Antwortvertrag, keine bestimmte Speichermethode.

## Open Questions

- keine
