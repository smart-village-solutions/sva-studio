# IAM-Admin-Exploration

Der lokale Explorationsrunner unter `apps/sva-studio-react/admin-exploration` prüft reale IAM-Admin-Pfade mit Playwright. Er ergänzt `test:e2e` und `test:acceptance` und ist kein verpflichtendes PR- oder CI-Gate.

## Technische Basis und Voraussetzungen

- Beide Laufmodi verwenden das bereits vorhandene `@playwright/test` und dessen Chromium-Browser.
- Der gemeinsame Browserloader liegt unter `apps/sva-studio-react/admin-exploration/runtime/browser.ts`.
- Workspace-Abhängigkeiten mit `pnpm install` installieren; die bestehende pnpm-Supply-Chain-Policy gilt auch für diesen Runner.
- Der Playwright-Chromium-Browser muss installiert sein: `pnpm exec playwright install chromium` im Ordner `apps/sva-studio-react`.
- Die konfigurierte Studio-App und der echte IAM-/Backend-Stack müssen erreichbar sein.
- Dedizierte Admin-Credentials für den Lauf bereitstellen.
- Es werden keine LLM-Zugangsdaten benötigt.

## Konfiguration

Die Variablen des Explorationsrunners verwenden den Präfix `IAM_EXPLORE_`.

| Variable | Bedeutung |
| --- | --- |
| `IAM_EXPLORE_ADMIN_BASE_URL` | Basisadresse der Studio-App; alternativ `IAM_ACCEPTANCE_BASE_URL` |
| `IAM_EXPLORE_ADMIN_USERNAME` | Dedizierter Admin; alternativ `IAM_ACCEPTANCE_ADMIN_USERNAME` |
| `IAM_EXPLORE_ADMIN_PASSWORD` | Passwort; alternativ `IAM_ACCEPTANCE_ADMIN_PASSWORD` |
| `IAM_EXPLORE_RUN_MODE` | `story-loop` oder `mission`; das Nx-Target wählt `story-loop` |
| `IAM_EXPLORE_ADMIN_MISSION` | Einzelmission; unterstützt ist `admin-users-overview` |
| `IAM_EXPLORE_HEADLESS` | Browseroption für den Einzelmissionsmodus; Standard `true`, `false` öffnet den Browser sichtbar |
| `IAM_EXPLORE_STORY_IDS` | Optionale CSV-Liste von Story-IDs |
| `IAM_EXPLORE_STORY_PACKAGE_IDS` | Optionale CSV-Liste von Paket-IDs, etwa `IAM-P2` |
| `IAM_EXPLORE_STORY_CLUSTERS` | Optionale CSV-Liste technischer Cluster |
| `IAM_EXPLORE_STORY_RESUME` | `true` überspringt Stories, die in der Story-Quelle nicht mehr `offen` sind |
| `IAM_EXPLORE_TENANT_BASE_URL` | Mandantenadresse für mutierende Tenant-Läufe |
| `IAM_EXPLORE_TENANT_USERNAME` | Dedizierter Tenant-Admin |
| `IAM_EXPLORE_TENANT_PASSWORD` | Passwort des Tenant-Admins |
| `IAM_EXPLORE_NEIGHBOR_TENANT_BASE_URL` | Nachbar-Mandant für Cross-Tenant-Negativnachweise |
| `IAM_EXPLORE_NEIGHBOR_TENANT_USERNAME` | Dedizierter Admin des Nachbar-Mandanten |
| `IAM_EXPLORE_NEIGHBOR_TENANT_PASSWORD` | Passwort dieses Admins |

Tenant- und Nachbar-Tenant-Konfigurationen müssen jeweils vollständig sein. Ungültige URLs, Story-IDs, Cluster oder fehlende Pflichtwerte führen früh zu `BLOCKED`.

## Ausführung

Standardlauf:

```bash
pnpm nx run sva-studio-react:test:explore:admin
```

Einzelmission, ausgeführt im Ordner `apps/sva-studio-react`:

```bash
IAM_EXPLORE_RUN_MODE=mission bash ../../scripts/ci/run-workspace-node.sh --import tsx ./admin-exploration/cli.ts
```

## Laufverhalten

Der Runner validiert die Konfiguration und prüft zuerst die Readiness der Base-URL.

Im Modus `story-loop` verarbeitet er den IAM-Katalog aus `concepts/konzeption-cms-v2/02_Anforderungen/user-stories.json` oder dem mitgelieferten Snapshot, gruppiert Stories in technische Cluster und schreibt Ergebnisse in ein separates Overlay. Die kanonische Story-Quelle wird nicht verändert. Die vorhandenen Browserläufe dieses Modus verwenden Chromium ohne sichtbares Fenster.

Implementierte Cluster umfassen:

- `tenant-user-create`: Login, Nutzeranlage und Detailansicht; ohne Cross-Tenant-Negativnachweis bleibt das Ergebnis `unklar`.
- `tenant-isolation`: Sichtbarkeit im Ausgangsmandanten und verweigerter API-/UI-Zugriff im Nachbar-Mandanten.
- `role-and-permission-management`: Rollen- und Rechteverwaltung über vorhandene fachliche Browserpfade.

Nicht implementierte oder mangels Umgebung nicht prüfbare Cluster werden als `umgebung_unzureichend` ausgewiesen. Mutierende Cluster benötigen dedizierte Testidentitäten und eine geeignete Testumgebung.

Im Einzelmissionsmodus öffnet der Runner `/admin/users` und liest das gerenderte HTML. Er meldet `passed` bei erkennbarer Benutzerverwaltung oder gültigem Leerzustand, `blocked` bei Login-Anforderung und `failed` bei Forbidden oder einem ungültigen Zielzustand. Der Browser wird auch bei Navigations- oder Lesefehlern geschlossen. Dieser einfache Modus führt keinen eigenen Login aus.

## Artefakte und Bewertung

Lokale Ergebnisse liegen unter `docs/reports/admin-exploration/<mission>/` beziehungsweise `docs/reports/admin-exploration/story-loop/`:

- `status.json`: strukturierter Missions- oder Aggregatstatus
- `report.md`: deutscher Bericht mit Findings und Story-Bezug
- `transcript.jsonl`: Schrittprotokoll; im Einzelmissionsmodus derzeit ein Bootstrap-Platzhalter
- `overlay.json`: Story-Ergebnisse des Story-Loops

Screenshots werden derzeit in keinem der beiden Laufmodi erfasst. Die Einzelmission schreibt lediglich den oben genannten Bootstrap-Platzhalter statt eines vollständigen Schrittprotokolls. Diese bereits bestehende Abweichung vom spezifizierten Evidenzvertrag ist als [Follow-up #1618](https://github.com/smart-village-solutions/sva-studio/issues/1618) erfasst.

Die Outputs sind lokal und werden nicht versioniert. Alte Laufartefakte werden nicht automatisch übernommen. Pfade in Berichten werden portabel dargestellt; ohne positive und erforderliche negative Evidenz wird keine Story als erfüllt gewertet. Ergebnisse dienen dem Review und ersetzen keine fachliche Abnahme.
