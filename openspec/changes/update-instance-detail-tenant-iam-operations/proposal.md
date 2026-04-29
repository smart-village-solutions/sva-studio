# Change: Tenant-IAM-Status und Operations auf der Instanz-Detailseite

## Why

Die aktuelle Instanz-Detailseite zeigt vor allem Registry-, Provisioning- und Keycloak-Strukturartefakte, aber keine verlässliche Aussage darüber, ob Tenant-IAM im laufenden Betrieb tatsächlich arbeitsfähig ist. Dadurch bleiben reale Tenant-IAM-Befunde wie `IDP_FORBIDDEN`, Reconcile-Backlog oder fehlende operative Rechte in `/admin/instances/$instanceId` unsichtbar, obwohl sie in `/admin/roles`, `/admin/users` oder Runtime-Diagnosen bereits auffallen.

Zusätzlich nutzt der Tenant-Rollen-Reconcile im aktuellen Pfad nicht durchgehend den tenantlokalen Admin-Client. Das erzeugt einen konkreten Fehlpfad und macht gleichzeitig sichtbar, dass Konfigurations-Readiness und operative Tenant-IAM-Betriebsfähigkeit bislang nicht getrennt modelliert sind.

## What Changes

- erweitert den Instanz-Detailvertrag um einen expliziten `tenantIamStatus`, der `configuration`, `access`, `reconcile` und `overall` getrennt ausweist
- ergänzt die Instanz-Detailseite `/admin/instances/$instanceId` um eine Tenant-IAM-Betriebssicht mit Diagnose, Korrelation und aktionsbezogener Guidance
- integriert nur fachlich sinnvolle bestehende Operator-Aktionen aus Instanzverwaltung und IAM-Reconcile in diesen Detailkontext
- ergänzt genau dort neue Serverunterstützung, wo eine echte Lücke besteht: eine explizite Tenant-IAM-Rechteprobe für den tenantlokalen Admin-Client
- korrigiert den Tenant-Rollen-Reconcile so, dass normale Tenant-Reconcile-Ausführungen ausschließlich den tenantlokalen Admin-Client verwenden
- begrenzt den ersten Ausbauschritt bewusst auf Detailansicht und On-Demand-Diagnostik; keine automatische Rechteprobe bei jedem Seitenaufruf und keine neue Listen-Ampel

## Impact

- Affected specs:
  - `account-ui`
  - `instance-provisioning`
  - `iam-core`
  - `iam-access-control`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/instances/*`
  - `apps/sva-studio-react/src/hooks/use-instances.ts`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `packages/core/src/iam/account-management-contract.ts`
  - `packages/instance-registry/src/*`
  - `packages/auth-runtime/src/iam-instance-registry/*`
  - `packages/auth-runtime/src/iam-account-management/*`
  - `packages/iam-admin/src/*`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
