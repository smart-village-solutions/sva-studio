import type { IdentityUserAttributes } from './keycloak-user-attributes.js';

export const haveEqualIdentityAttributes = (
  current: IdentityUserAttributes | null | undefined,
  expected: IdentityUserAttributes
): boolean => {
  const currentEntries = Object.entries(current ?? {});
  return (
    currentEntries.length === Object.keys(expected).length &&
    currentEntries.every(([key, currentValues]) => {
      const expectedValues = expected[key];
      return (
        expectedValues !== undefined &&
        currentValues.length === expectedValues.length &&
        currentValues.every((value, index) => value === expectedValues[index])
      );
    })
  );
};
