## ADDED Requirements

### Requirement: Admin Resource List Search Params
The routing package SHALL provide canonical, typed search-parameter normalization for admin resource lists that declare host-managed search, filters, sorting, or pagination.

#### Scenario: Resource list state is normalized from URL
- **GIVEN** an admin resource declares host-managed list capabilities
- **WHEN** the route is opened with search, filter, sorting, or pagination parameters
- **THEN** routing normalizes the parameters against the resource declaration
- **AND** passes only validated list state to the host bindings and data adapter

#### Scenario: Invalid list parameters fall back to defaults
- **GIVEN** an admin resource declares allowed sort fields, filter values, and page sizes
- **WHEN** the route is opened with unsupported values
- **THEN** routing replaces them with declared defaults or removes them from normalized state
- **AND** the resulting route state remains reloadable and shareable

#### Scenario: Resource omits host-managed list capabilities
- **GIVEN** an admin resource does not declare host-managed list capabilities
- **WHEN** the route is materialized
- **THEN** routing keeps the legacy behavior for that resource
- **AND** does not require new search-parameter declarations

#### Scenario: Duplicate resource search parameters are rejected
- **GIVEN** an admin resource declares duplicate search, filter, sorting, or pagination parameter names
- **WHEN** the registry or route snapshot is validated
- **THEN** validation fails with diagnostics that identify the resource and conflicting parameters
