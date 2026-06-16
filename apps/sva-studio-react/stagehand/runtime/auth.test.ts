import { describe, expect, it } from 'vitest';

import { detectStagehandAuthIssue } from './auth.ts';

describe('detectStagehandAuthIssue', () => {
  it('classifies 401 responses as login issues', () => {
    const issue = detectStagehandAuthIssue({
      bodyText: '<html></html>',
      requestedUrl: 'https://studio.example.test/admin/users',
      response: new Response('', { status: 401 }),
    });

    expect(issue).toEqual({
      kind: 'login',
      message: 'Login-Anforderung erkannt; der Pilotlauf bricht ab, statt eine Login-Schleife zu tolerieren.',
    });
  });

  it('classifies 403 responses as forbidden issues', () => {
    const issue = detectStagehandAuthIssue({
      bodyText: '<html></html>',
      requestedUrl: 'https://studio.example.test/admin/users',
      response: new Response('', { status: 403 }),
    });

    expect(issue).toEqual({
      kind: 'forbidden',
      message: 'Forbidden-Zustand erkannt; die Mission schlägt fehl.',
    });
  });

  it('detects login redirects from relative locations', () => {
    const issue = detectStagehandAuthIssue({
      bodyText: '<html></html>',
      requestedUrl: 'https://studio.example.test/admin/users',
      response: new Response('', {
        status: 302,
        headers: {
          location: '/auth/login?returnTo=%2Fadmin%2Fusers',
        },
      }),
    });

    expect(issue?.kind).toBe('login');
  });

  it('detects forbidden redirects when the target contains forbidden', () => {
    const issue = detectStagehandAuthIssue({
      bodyText: '<html></html>',
      requestedUrl: 'https://studio.example.test/admin/users',
      response: new Response('', {
        status: 307,
        headers: {
          location: '/forbidden',
        },
      }),
    });

    expect(issue).toEqual({
      kind: 'forbidden',
      message: 'Forbidden-Redirect erkannt; die Mission schlägt fehl.',
    });
  });

  it('ignores invalid redirect locations and falls through to null', () => {
    const issue = detectStagehandAuthIssue({
      bodyText: '<html><body>dashboard</body></html>',
      requestedUrl: 'https://studio.example.test/admin/users',
      response: new Response('', {
        status: 302,
        headers: {
          location: 'http://%',
        },
      }),
    });

    expect(issue).toBeNull();
  });

  it('detects login state from the final response url', () => {
    const response = new Response('<html></html>', { status: 200 });
    Object.defineProperty(response, 'url', {
      value: 'https://studio.example.test/auth/login?returnTo=%2Fadmin%2Fusers',
    });

    const issue = detectStagehandAuthIssue({
      bodyText: '<html></html>',
      requestedUrl: 'https://studio.example.test/admin/users',
      response,
    });

    expect(issue?.kind).toBe('login');
  });

  it('detects login hints from the response url even without a login path', () => {
    const response = new Response('<html></html>', { status: 200 });
    Object.defineProperty(response, 'url', {
      value: 'https://studio.example.test/admin/users?auth=login',
    });

    const issue = detectStagehandAuthIssue({
      bodyText: '<html></html>',
      requestedUrl: 'https://studio.example.test/admin/users',
      response,
    });

    expect(issue?.kind).toBe('login');
  });

  it('detects login hints from the html body', () => {
    const issue = detectStagehandAuthIssue({
      bodyText: '<main>Bitte erneut anmelden</main>',
      requestedUrl: 'https://studio.example.test/admin/users',
      response: new Response('<main>Bitte erneut anmelden</main>', { status: 200 }),
    });

    expect(issue).toEqual({
      kind: 'login',
      message: 'Login-Hinweise im HTML erkannt; der Pilotlauf bricht ab, statt eine Login-Schleife zu tolerieren.',
    });
  });

  it('detects forbidden hints from the html body or response url', () => {
    const bodyIssue = detectStagehandAuthIssue({
      bodyText: '<main>Keine Berechtigung</main>',
      requestedUrl: 'https://studio.example.test/admin/users',
      response: new Response('<main>Keine Berechtigung</main>', { status: 200 }),
    });

    expect(bodyIssue?.kind).toBe('forbidden');
  });
});
