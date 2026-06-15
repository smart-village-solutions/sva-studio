import type { StagehandStoryReference } from '../stories/catalog.js';

export interface CreateMissionPromptInput {
  readonly startUrl: string;
  readonly stories: readonly StagehandStoryReference[];
}

function renderStoryLine(story: StagehandStoryReference): string {
  return `Story ${story.id} (${story.packageId}): ${story.title}`;
}

export function createMissionPrompt({ startUrl, stories }: CreateMissionPromptInput): string {
  return [
    `Open ${startUrl} and stay on the admin users overview rooted at /admin/users.`,
    'If authentication is required, log in with the provided admin credentials.',
    'Fail immediately when a Login page, a Login redirect loop, or any Forbidden state appears.',
    'Confirm a visible Benutzerliste or a fachlich validierten Leerzustand for the users overview before stopping.',
    'Use the following user-story basis as acceptance context:',
    ...stories.map(renderStoryLine),
  ].join('\n');
}
