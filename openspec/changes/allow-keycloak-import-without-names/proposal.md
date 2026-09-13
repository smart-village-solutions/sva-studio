# Change: Keycloak-Import ohne Namen zulassen

## Why

Der produktive Keycloak-Import für `hb-meinquartier` lässt einen stabilen Bestand von Benutzern in `manual_review`, obwohl für deren tenantlokale Membership nur die Identität und eine auflösbare E-Mail erforderlich sind. Fehlende Vor- oder Nachnamen dürfen die Übernahme bestehender Member nicht blockieren und sollen nicht durch erfundene Platzhalterwerte in Keycloak kaschiert werden.

## What Changes

- Begrenzt die harte Profilvoraussetzung des tenantlokalen Keycloak-Imports auf eine nach dem bestehenden Fallback-Pfad weiterhin fehlende E-Mail.
- Übernimmt Benutzer mit vorhandener beziehungsweise vertrauenswürdig reparierter E-Mail auch dann in `iam.accounts` und `iam.instance_memberships`, wenn Vor- oder Nachname fehlen.
- Behält vorhandene Keycloak-Profilwerte als vorrangige Quelle bei und schreibt keine Default-Namen wie `Unbekannt` nach Keycloak.
- Belässt eine nicht auflösbare E-Mail als fachlichen `manual_review`-Zustand ohne IAM-Persistenz.
- Ändert nicht die Pflichtfelder für die aktive Neuanlage eines Benutzers im Studio.

## Impact

- Related issue: #1334
- Affected specs: `iam-core`
- Affected code: `packages/auth-runtime/src/iam-account-management/user-import-sync-handler.ts` und zugehörige Tests
- Affected documentation: `docs/architecture/05-building-block-view.md`, `docs/architecture/08-cross-cutting-concepts.md`
- Database impact: keine Migration; Vor- und Nachname sind in `iam.accounts` bereits nullable
- Delivery: ein kleiner, eigenständig test- und reviewbarer PR; kein PR-Stack erforderlich
