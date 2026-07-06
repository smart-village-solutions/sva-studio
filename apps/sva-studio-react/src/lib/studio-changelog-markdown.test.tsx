import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StudioChangelogMarkdown } from './studio-changelog-markdown';

describe('StudioChangelogMarkdown', () => {
  it('renders paragraphs, emphasis, bullet lists, and safe links', () => {
    render(
      <StudioChangelogMarkdown>
        {'Erste **wichtige** Zeile mit [Link](https://example.com).\n\n- Punkt eins\n- Punkt zwei mit *Hinweis*'}
      </StudioChangelogMarkdown>
    );

    expect(screen.getByText('Erste')).toBeTruthy();
    expect(screen.getByText('wichtige').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: 'Link' }).getAttribute('href')).toBe('https://example.com');
    expect(screen.getByText('Punkt eins')).toBeTruthy();
    expect(screen.getByText('Hinweis').tagName).toBe('EM');
  });

  it('does not turn unsupported or unsafe links into anchors', () => {
    render(
      <StudioChangelogMarkdown>
        {'Bitte pruefen: [unsicher](javascript:alert(1))'}
      </StudioChangelogMarkdown>
    );

    expect(screen.queryByRole('link', { name: 'unsicher' })).toBeNull();
    expect(screen.getByText('[unsicher](javascript:alert(1))')).toBeTruthy();
  });
});
