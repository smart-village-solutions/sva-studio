export interface CreateMissionPromptInput {
  readonly startUrl: string;
}

export function createMissionPrompt({ startUrl }: CreateMissionPromptInput): string {
  return [
    `Open ${startUrl} and stay on the admin users overview rooted at /admin/users.`,
    'If authentication is required, log in with the provided admin credentials.',
    'Fail immediately when a Login page, a Login redirect loop, or any Forbidden state appears.',
    'Confirm a visible Benutzerliste or a fachlich valid Leerzustand for the users overview before stopping.',
  ].join('\n');
}
