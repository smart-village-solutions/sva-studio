## MODIFIED Requirements

### Requirement: Host-Validated Plugin Content Contributions

The system SHALL accept plugin-provided content contributions only through the validated build-time registry and SHALL validate content type identifiers, fields, actions, UI bindings, and declared content mutation capabilities before they become available in the Studio.

Plugin content mutation handlers MAY execute the plugin-owned domain mapping and call the plugin's existing API client for declared delete or status operations. The host SHALL retain action availability, list orchestration, bulk results, refresh behavior, and the existing server authorization boundary. Contributions SHALL NOT define new direct persistence paths, server handlers, request validation bypasses, routing bypasses, authorization bypasses, or dynamic registration after the validated snapshot is published.

#### Scenario: Valid content contribution is registered

- **GIVEN** a plugin declares a namespaced content type and valid content mutation capabilities
- **WHEN** the host validates the plugin registry snapshot
- **THEN** the content contribution becomes available through host-owned content routes and actions
- **AND** only the declared capabilities for that content type can be resolved

#### Scenario: Content contribution uses unsupported runtime behavior

- **GIVEN** a plugin contribution declares unsupported persistence, routing, authorization, or UI bindings detectable in the contribution metadata
- **WHEN** the host validates the contribution
- **THEN** the host rejects the contribution with a deterministic diagnostics result
- **AND** the diagnostics include one of `plugin_guardrail_persistence_bypass`, `plugin_guardrail_route_bypass`, `plugin_guardrail_authorization_bypass`, or `plugin_guardrail_unsupported_binding`
- **AND** registry validation checks declarations and handler availability without claiming to inspect arbitrary handler implementation behavior

#### Scenario: Content UI triggers a declared mutation

- **GIVEN** a user triggers a declared delete or status capability and has the required action available
- **WHEN** the host invokes the validated plugin handler
- **THEN** the host preserves its list, bulk-result, error, and refresh responsibilities
- **AND** validation, authorization, persistence, and audit emission continue through the existing host-supported API path
- **AND** the existing server-side authorization remains authoritative

#### Scenario: Content UI triggers host-owned action

- **GIVEN** a plugin content UI renders a publish button bound to a declared host-supported action
- **WHEN** a user triggers the action
- **THEN** the host performs validation, authorization, persistence, and audit emission
- **AND** the plugin does not bypass the host content action path

#### Scenario: Plugin attempts dynamic content registration

- **GIVEN** a plugin tries to register a content type after the build-time registry snapshot was published
- **WHEN** the host receives the dynamic registration attempt
- **THEN** the host rejects the registration
- **AND** the diagnostics include `plugin_guardrail_dynamic_registration` with plugin namespace and contribution identifier

#### Scenario: Mutation capability is missing or removed

- **GIVEN** a content type has no registered handler for a requested mutation
- **WHEN** the user attempts to start or directly invoke that mutation
- **THEN** the host does not offer an executable mutation and returns a controlled unsupported-capability result
- **AND** no hard-coded plugin client is used as a fallback

#### Scenario: Status mutation preserves unrelated fields

- **GIVEN** a plugin status handler updates a status field on an existing content item
- **WHEN** the plugin reads, merges, and writes the item
- **THEN** every field not targeted by the status transition retains its prior value

#### Scenario: Status mutation rejects a degraded detail response

- **GIVEN** a successful detail read reports a data deviation affecting an unrelated field that the status update would write back
- **WHEN** the plugin prepares the status mutation
- **THEN** the plugin rejects the mutation before calling the update API
- **AND** the host reports the error through the existing UI error path
- **AND** filtered, defaulted, or otherwise incompletely preserved data is not written back

#### Scenario: Deviation has no unrelated write effect

- **GIVEN** a detail response reports deviations only for the status field deliberately replaced by the transition or for read-only metadata with no write effect
- **WHEN** the plugin prepares the otherwise valid status mutation
- **THEN** those deviations alone do not prevent the update
- **AND** the existing principal is passed to the detail read and the update

#### Scenario: Existing host bulk behavior remains unchanged

- **GIVEN** the host performs an existing IAM bulk operation for explicitly selected eligible entries
- **WHEN** some entries succeed and others fail
- **THEN** the host preserves the existing per-entry results, retry selection, and refresh behavior
- **AND** individual plugin mutation capabilities do not expand bulk eligibility or introduce a new plugin bulk dispatch

#### Scenario: Browser handlers remain outside server descriptors

- **GIVEN** a plugin contributes executable content mutation handlers for the Studio browser
- **WHEN** the host builds server descriptors, manifests, or job runtime inputs
- **THEN** those browser handlers are absent from those serializable and server-side artifacts
