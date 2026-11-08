/** Lazy Tabler glyph rendering with a stable, decorative fallback. */
import * as React from 'react';
import { IconAppWindow, type IconProps } from '@tabler/icons-react';
import { tablerIconExports } from './tabler-icon-catalog.js';
type Glyph = React.ComponentType<IconProps>;
let glyphs: Promise<Readonly<Record<string, unknown>>> | undefined;
export const TablerIcon = ({ name, ...props }: IconProps & { readonly name: string }) => {
  const exportName = tablerIconExports[name];
  const [loaded, setLoaded] = React.useState<{ name: string; glyph: Glyph } | null>(null);
  React.useEffect(() => {
    let current = true;
    if (exportName) {
      glyphs ??= import('./tabler-icon-glyphs.js').then((module) => module.iconGlyphs);
      void glyphs
        .then((icons) => {
          if (current && icons[exportName]) setLoaded({ name, glyph: icons[exportName] as Glyph });
        })
        .catch(() => {
          /* The fallback remains visible; selection is still named. */
        });
    }
    return () => {
      current = false;
    };
  }, [name, exportName]);
  const Icon = loaded?.name === name ? loaded.glyph : IconAppWindow;
  return <Icon {...props} aria-hidden="true" stroke={2} />;
};
