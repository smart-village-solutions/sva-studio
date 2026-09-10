import { afterEach, describe, expect, it } from 'vitest';
import {
  readDocumentStudioBranding,
  resolveStudioBranding,
  STUDIO_BRANDING_PROFILES,
  STUDIO_BRANDING_META_NAME,
} from './studio-branding';

describe('studio branding', () => {
  afterEach(() =>
    document.head
      .querySelectorAll(`meta[name="${STUDIO_BRANDING_META_NAME}"]`)
      .forEach((node) => node.remove())
  );

  it.each([undefined, '', 'unknown', 'constructor', 'sva-studio'])(
    'defaults safely for %s',
    (value) => {
      expect(resolveStudioBranding(value)).toBe('sva-studio');
    }
  );

  it('restores the server-selected profile from the document for client navigation', () => {
    expect(readDocumentStudioBranding()).toBe('sva-studio');
    const meta = document.createElement('meta');
    meta.name = STUDIO_BRANDING_META_NAME;
    meta.content = 'kassel-dialog';
    document.head.append(meta);
    expect(readDocumentStudioBranding()).toBe('kassel-dialog');
    meta.content = 'invalid';
    expect(readDocumentStudioBranding()).toBe('sva-studio');
  });

  it('maps each profile to its app-wide product name', () => {
    expect(STUDIO_BRANDING_PROFILES['sva-studio'].appNameKey).toBe('shell.appName');
    expect(STUDIO_BRANDING_PROFILES['sva-studio']).toMatchObject({
      showContentNavigation: true,
      showGenericApplicationLinks: true,
      showInterfacesNavigation: true,
      showModulesNavigation: true,
    });
    expect(STUDIO_BRANDING_PROFILES['kassel-dialog'].appNameKey).toBe(
      'home.branding.kasselDialog.title'
    );
    expect(STUDIO_BRANDING_PROFILES['kassel-dialog']).toMatchObject({
      showContentNavigation: false,
      showGenericApplicationLinks: false,
      showInterfacesNavigation: false,
      showModulesNavigation: false,
    });
  });

  it('uses the default profile when no document exists', () => {
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    if (documentDescriptor?.configurable === false) return;

    try {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined });
      expect(readDocumentStudioBranding()).toBe('sva-studio');
    } finally {
      if (documentDescriptor) {
        Object.defineProperty(globalThis, 'document', documentDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'document');
      }
    }
  });
});
