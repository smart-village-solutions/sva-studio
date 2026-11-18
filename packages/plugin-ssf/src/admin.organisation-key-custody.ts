import { useCallback, useRef } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { b64 } from './organisation-key-crypto.js';

/** Local private material and the temporary browser objects used to export it. */
export function useOrganisationKeyCustody() {
  const pt = usePluginTranslation('ssf');
  const custody = useRef<{ key: CryptoKey; file: string } | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const link = useRef<string | null>(null);
  const release = useCallback(() => {
    frame.current?.remove();
    frame.current = null;
    if (link.current) {
      URL.revokeObjectURL(link.current);
      link.current = null;
    }
  }, []);
  const clear = useCallback(() => {
    custody.current = null;
    release();
  }, [release]);
  const download = (keyId: string) => {
    if (!custody.current) return false;
    release();
    link.current = URL.createObjectURL(
      new Blob([custody.current.file], { type: 'application/json' })
    );
    const a = document.createElement('a');
    a.href = link.current;
    a.download = 'ssf-organisation-key-' + keyId + '.json';
    a.click();
    return true;
  };
  const print = () => {
    if (!custody.current) return false;
    release();
    const sheet = document.createElement('iframe');
    sheet.title = pt('keys.print');
    sheet.className = 'sr-only';
    document.body.appendChild(sheet);
    frame.current = sheet;
    const doc = sheet.contentDocument,
      win = sheet.contentWindow;
    if (!doc || !win) {
      release();
      return false;
    }
    doc.title = pt('keys.print');
    const notice = doc.createElement('p');
    notice.textContent = pt('keys.printNotice');
    const data = doc.createElement('p');
    data.style.overflowWrap = 'anywhere';
    data.textContent = b64(new TextEncoder().encode(custody.current.file));
    doc.body.replaceChildren(notice, data);
    win.addEventListener('afterprint', release, { once: true });
    win.focus();
    win.print();
    return true;
  };
  return { custody, clear, download, print };
}
