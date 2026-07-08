import React from 'react';

const SAFE_LINK_PATTERN = /^(https?:\/\/|mailto:)/u;

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'link'; label: string; href: string };

const tokenizeInlineMarkdown = (value: string): InlineToken[] => {
  const tokens: InlineToken[] = [];
  let currentIndex = 0;

  const flushText = (nextIndex: number) => {
    if (nextIndex > currentIndex) {
      tokens.push({ type: 'text', value: value.slice(currentIndex, nextIndex) });
    }
  };

  while (currentIndex < value.length) {
    const linkMatch = value.slice(currentIndex).match(/^\[([^\]]+)\]\(([^)\s]+)\)/u);
    if (linkMatch) {
      if (SAFE_LINK_PATTERN.test(linkMatch[2]!)) {
        tokens.push({ type: 'link', label: linkMatch[1]!, href: linkMatch[2]! });
      } else {
        tokens.push({ type: 'text', value: linkMatch[0] });
      }
      currentIndex += linkMatch[0].length;
      continue;
    }

    const strongMatch = value.slice(currentIndex).match(/^\*\*([^*]+)\*\*/u);
    if (strongMatch) {
      tokens.push({ type: 'strong', value: strongMatch[1]! });
      currentIndex += strongMatch[0].length;
      continue;
    }

    const emphasisMatch = value.slice(currentIndex).match(/^\*([^*]+)\*/u);
    if (emphasisMatch) {
      tokens.push({ type: 'em', value: emphasisMatch[1]! });
      currentIndex += emphasisMatch[0].length;
      continue;
    }

    const nextSpecialIndexCandidates = ['[', '*']
      .map((character) => value.indexOf(character, currentIndex + 1))
      .filter((index) => index >= 0);
    const nextSpecialIndex = nextSpecialIndexCandidates.length > 0 ? Math.min(...nextSpecialIndexCandidates) : value.length;
    flushText(nextSpecialIndex);
    currentIndex = nextSpecialIndex;
  }

  return tokens;
};

const renderInlineTokens = (value: string): React.ReactNode[] =>
  tokenizeInlineMarkdown(value).map((token, index) => {
    const key = `${token.type}-${index}`;
    switch (token.type) {
      case 'strong':
        return <strong key={key}>{token.value}</strong>;
      case 'em':
        return <em key={key}>{token.value}</em>;
      case 'link':
        return (
          <a key={key} href={token.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            {token.label}
          </a>
        );
      case 'text':
      default:
        return <React.Fragment key={key}>{token.value}</React.Fragment>;
    }
  });

const isBulletLine = (line: string): boolean => line.trimStart().startsWith('- ');

export const StudioChangelogMarkdown = ({
  children,
}: {
  readonly children: string;
}) => {
  const blocks = children
    .trim()
    .split(/\n\s*\n/u)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3 text-sm leading-6 text-foreground">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);

        if (lines.every(isBulletLine)) {
          return (
            <ul key={`block-${blockIndex}`} className="list-disc space-y-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={`item-${blockIndex}-${lineIndex}`}>{renderInlineTokens(line.replace(/^- /u, ''))}</li>
              ))}
            </ul>
          );
        }

        return <p key={`block-${blockIndex}`}>{renderInlineTokens(lines.join(' '))}</p>;
      })}
    </div>
  );
};
