/** Managed competence tags use the consumer-compatible BCP 47 subset. */
export const normalizeCompetenceLanguages = (values: readonly string[]): string[] => {
  if (values.length > 40) throw new Error('competence_languages_too_many');
  const normalized = values.map((value) => {
    const tag = value.trim();
    if (tag.length > 35 || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u.test(tag)) {
      throw new Error('competence_language_invalid');
    }
    const canonical = Intl.getCanonicalLocales(tag)[0];
    if (!canonical) throw new Error('competence_language_invalid');
    return canonical;
  });
  return [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
};
