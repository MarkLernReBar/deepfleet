/** Lowercase alphanumeric segments separated by hyphens (no leading/trailing hyphen). */
export const SKILL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSkillSlug(slug: string): boolean {
  return SKILL_SLUG_PATTERN.test(slug);
}
