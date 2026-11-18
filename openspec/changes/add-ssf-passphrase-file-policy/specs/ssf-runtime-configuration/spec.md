## ADDED Requirements

### Requirement: Local passphrase file policy

Studio SHALL administer and emit `recording.passphraseFileEnabled` as a strict boolean through the existing SSF recording settings and runtime policy. The effective value SHALL resolve from an explicit tenant override, then the installation default, then false. Missing fields in older policies SHALL remain valid. Existing recording enablement and access permissions SHALL remain independent.

#### Scenario: Disabled fallback

- **WHEN** an existing complete recording policy has no passphrase file setting
- **THEN** its effective runtime setting is false
- **AND** absent or incomplete recording policies remain omitted

#### Scenario: Tenant choices and reset

- **WHEN** an administrator selects Enabled or Disabled for a tenant
- **THEN** that explicit boolean is preserved even when equal to the installation default
- **AND** choosing Inherited removes the explicit choice and applies the current installation default

#### Scenario: Validation and revision

- **WHEN** policy input contains a string, number or null instead of a boolean
- **THEN** the write is rejected
- **AND** valid changes alter configurationRevision only when the effective policy changes

#### Scenario: Localized administration

- **WHEN** an authorized administrator edits the setting
- **THEN** German and English controls explain that TXT files contain an unencrypted passphrase and must remain private
- **AND** read-only users cannot change the setting
