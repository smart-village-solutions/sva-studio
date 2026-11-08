import { expect, it } from 'vitest';
import { createSsfRecordingDirectory } from '../src/recording-directory.js';
const subject = {
  keycloakSubject: 'synthetic-reviewer',
  displayName: 'Synthetic Reviewer',
  permissionIds: ['ssf.recording.review'],
  languages: ['de', 'en'],
};
it('binds revision to normalized permissions, languages, display names and membership', () => {
  const base = createSsfRecordingDirectory('tenant-a', [subject]);
  expect(
    createSsfRecordingDirectory('tenant-a', [{ ...subject, languages: ['en', 'de', 'de'] }])
  ).toEqual(base);
  for (const changed of [
    [],
    [{ ...subject, permissionIds: ['ssf.recording.supervise'] }],
    [{ ...subject, languages: ['fr'] }],
    [{ ...subject, displayName: 'Synthetic Updated' }],
  ]) {
    expect(createSsfRecordingDirectory('tenant-a', changed).directoryRevision).not.toBe(
      base.directoryRevision
    );
  }
  expect(createSsfRecordingDirectory('tenant-b', [subject]).directoryRevision).not.toBe(
    base.directoryRevision
  );
});
it('refuses malformed and oversized sources instead of returning partial directories', () => {
  expect(() => createSsfRecordingDirectory('tenant-a', [subject, subject])).toThrow();
  expect(() =>
    createSsfRecordingDirectory('tenant-a', [{ ...subject, keycloakSubject: 'has space' }])
  ).toThrow();
  expect(() =>
    createSsfRecordingDirectory(
      'tenant-a',
      Array.from({ length: 10001 }, (_, index) => ({
        ...subject,
        keycloakSubject: `synthetic-${index}`,
      }))
    )
  ).toThrow();
});

it('bounds long display labels without dropping eligible subjects or splitting Unicode code points', () => {
  const fullName = `${'A'.repeat(120)} ${'B'.repeat(120)}`;
  const directory = createSsfRecordingDirectory('tenant-a', [
    { ...subject, displayName: fullName },
    { ...subject, keycloakSubject: 'synthetic-unicode', displayName: '😀'.repeat(220) },
  ]);
  expect(directory.users).toHaveLength(2);
  expect(directory.users[0]?.displayName).toBe(fullName.slice(0, 200));
  expect(Array.from(directory.users[1]?.displayName ?? '')).toHaveLength(200);
  expect(directory.users[1]?.displayName).toBe('😀'.repeat(200));
});
