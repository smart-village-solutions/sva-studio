# Assurance: Multi-tenant Public-Waste release

## Trust boundaries

| Boundary | Invariant | Evidence |
| --- | --- | --- |
| GitHub release tag to GHCR | One tag maps to one published public-waste image tag. | Build job output and image reference. |
| GitHub Environment to Portainer | Each deploy job reads only its environment's variables and secret and updates only its configured stack. | Workflow matrix/environment contract test and per-job release summary. |
| Portainer stack to public runtime | Each target verifies its own health, HTML shell, and public selection API after update. | Terminal deploy job smoke steps. |

## Rollout evidence

- GitHub run for tag `waste-web-v0.1.16` is terminal-successful for the single build and both deploy jobs.
- Both job summaries report the same image tag and their own stack/base URL.
- The two public URLs return successful health and selection endpoint responses after deployment.

## Explicitly excluded recovery behavior

No automatic rollback is introduced. A partially successful release retains the already verified target and requires an explicit, evidence-backed operator decision for the failed target.
