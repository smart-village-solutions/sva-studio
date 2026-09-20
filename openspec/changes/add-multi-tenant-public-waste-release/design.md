## Context

Die öffentliche Waste-Web-App ist bewusst vom Studio-Stack getrennt. Die vorhandenen GitHub-Environments `web-waste-calendar` und `web-waste-calendar-frankfurt-oder` besitzen jeweils eigene Basis-URL, Stack-Namen und Quantum-Zugang. Der bisherige Workflow bindet jedoch nur das erste Environment an einen einzelnen Job.

## Decision

Der Workflow erhält einen Build-Job ohne Deployment-Environment und einen matrixbasierten Deploy-Job mit genau den beiden bestehenden Environment-Namen. Der Build-Job veröffentlicht `ghcr.io/smart-village-solutions/public-waste-calendar-web:v<version>` einmal. Jeder Deploy-Matrixeintrag wird an sein GitHub-Environment gebunden, übernimmt dessen `PUBLIC_WASTE_*`-Variablen und `QUANTUM_API_KEY`, aktualisiert ausschließlich `PUBLIC_WASTE_IMAGE_TAG` seines eigenen Stacks und führt die bestehenden drei Smokes gegen die eigene URL aus.

## Invariants

1. Ein Release-Tag erzeugt genau einen Image-Tag und beide Zielstacks referenzieren diesen identischen Tag.
2. Ein Deploy-Job kann weder Variablen noch Secret eines anderen Environments lesen oder dessen Stacknamen verwenden.
3. Prignitz- und Frankfurt-Smokes verwenden stets die URL des jeweiligen Environment-Jobs.
4. Ein Fehlschlag eines Zieljobs ist terminal und sichtbar; bereits erfolgreiche Zieljobs werden nicht automatisch verändert oder zurückgerollt.
5. Der normale Studio-Build/-Promote-Pfad bleibt unverändert.

## Failure Modes

| Failure | Behavior | Evidence / response |
| --- | --- | --- |
| Image build or push fails | No deploy job starts. | GitHub workflow fails before either remote stack is changed. |
| Environment configuration/secret is missing | Only the affected deploy job fails before its Portainer update. | Job log identifies the missing contract key without exposing secrets. |
| Prignitz deploy succeeds, Frankfurt smoke fails (or inverse) | The workflow is red; the successful stack remains on the new tag. | Operator diagnoses the failed target and explicitly rolls back or retries only after identifying the cause. |
| Wrong stack or base URL is configured | Existing release helper or smoke fails for that target. | No automatic cross-target fallback exists. |

## Verification

- Extend a focused workflow contract test to assert one build/push and exactly the two environment-bound deploy targets.
- Run the existing Public-Waste release-helper test and scripts TypeScript check.
- Run the Public-Waste app build and file-placement check.
- After merge, publish `waste-web-v0.1.16`, wait for both deploy jobs, and capture health, HTML and public selection endpoint success per target.
