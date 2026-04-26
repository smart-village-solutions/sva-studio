## ADDED Requirements

### Requirement: News Full-model Operations Use Existing Qualified Actions

The expanded News model SHALL continue to use fully-qualified News plugin actions for UI affordances and authorization metadata.

The existing News actions SHALL cover full-model create, edit, update, and delete flows unless a distinct operation has a separate user-visible permission requirement.

#### Scenario: User edits full News fields

- **GIVEN** the News editor exposes the full Mainserver News model
- **WHEN** a user edits fields such as categories, address, source URL, content blocks, or metadata
- **THEN** the UI uses the existing fully-qualified News edit/update action metadata
- **AND** authorization still maps to the corresponding local content primitive checks in the host facade

### Requirement: Push Notification Is Explicitly Authorized If Exposed

If the News editor exposes `pushNotification` as a user-selectable operation option, the system SHALL model its action semantics explicitly.

The implementation SHALL either map push notification sending to an existing qualified News action with documented semantics or introduce a new fully-qualified action such as `news.pushNotification`.

#### Scenario: User triggers push notification during News save

- **GIVEN** the News editor exposes a push notification option
- **WHEN** the user submits the form with that option enabled
- **THEN** the UI action metadata and host authorization path make the additional operation explicit
- **AND** the option is not silently treated as a generic payload field
