## 1. Workflow and tests

- [x] 1.1 Split the existing Public-Waste workflow into a single image build/push job and two environment-bound deploy jobs for the existing Prignitz and Frankfurt (Oder) environments.
- [x] 1.2 Preserve the existing tag validation, release-helper contract, target-local stack update, and all three runtime smokes in each deploy job.
- [x] 1.3 Add focused workflow contract coverage for the single-build, same-tag and two-target isolation invariants.

## 2. Documentation

- [x] 2.1 Update `docs/operations/public-waste-web-release-runbook.md` for both configured release targets and partial-failure handling.
- [x] 2.2 Update the affected arc42 sections `05`, `07` and `08` with the multi-target public-waste release boundary, without defining a second Studio rollout path.

## 3. Verification and rollout

- [x] 3.1 Run the focused workflow/helper tests, scripts TypeScript check, Public-Waste app build, file-placement check and strict OpenSpec validation.
- [ ] 3.2 Open and merge a review-ready PR with a user-facing Studio changelog entry.
- [ ] 3.3 Create and push `waste-web-v0.1.16`; verify terminal-successful deployment jobs and target-local smoke results for Prignitz and Frankfurt (Oder).
