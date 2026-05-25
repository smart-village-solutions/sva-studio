# WP-003 Zielumgebungs-Smoke-Test: Organisation und Hierarchie

Stand: `2026-05-25`

## Zweck

Dieses Kurzprotokoll bereitet den in der `48h`-Checkliste geforderten Zielumgebungs-Smoke-Test für `WP-003` vor und definiert genau die Evidenz, die im Kundentermin referenziert werden soll.

Der tatsächliche Lauf ist im Repository nicht reproduzierbar. Dieses Dokument schließt deshalb die formale Dokumentationslücke vor und markiert den noch ausstehenden Umgebungsdurchlauf explizit.

## Verbindliche Prüfschritte

| Schritt | Erwarteter Nachweis | Status |
| --- | --- | --- |
| Parent-Child-Anlage in Zielumgebung durchführen | sichtbarer Hierarchiepfad nach dem Anlegen, stabiler Detailzustand, Datum/Uhrzeit | Zielumgebungslauf offen |
| Parent-Child-Re-Zuordnung durchführen | aktualisierter Hierarchiepfad ohne Inkonsistenz, stabiler UI-Zustand | Zielumgebungslauf offen |
| Tenant-Grenzen oder Negativpfad prüfen | Fehlermeldung oder Sperre bei instanzfremder Parent-Zuordnung | Zielumgebungslauf offen |
| Hierarchiepfad nach Änderung sichern | Screenshot oder Export mit finaler Struktur | Zielumgebungslauf offen |

## Repo-seitige Stützbelege

- [docs/reports/wp-003-organisation-struktur-abnahme-2026-05-25.md](./wp-003-organisation-struktur-abnahme-2026-05-25.md)
- [docs/reports/iam-organization-management-verification-2026-03-09.md](./iam-organization-management-verification-2026-03-09.md)
- [apps/sva-studio-react/src/routes/admin/organizations/-organization-create-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/organizations/-organization-create-page.test.tsx)
- [apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx)
- [packages/iam-admin/src/organization-mutation-handlers.test.ts](../../packages/iam-admin/src/organization-mutation-handlers.test.ts)
- [packages/iam-admin/src/organization-read-handlers.test.ts](../../packages/iam-admin/src/organization-read-handlers.test.ts)

## Verwendung im Kundentermin

- Führendes Fachprotokoll bleibt `WP-003`.
- Dieses Kurzprotokoll dient ausschließlich dazu, den noch offenen Zielumgebungs-Smoke-Test normiert zu archivieren.
- Sobald der Lauf erfolgt ist, werden Datum, Umgebung und Artefaktverweise hier ergänzt; bis dahin bleibt der Status transparent gelb.
