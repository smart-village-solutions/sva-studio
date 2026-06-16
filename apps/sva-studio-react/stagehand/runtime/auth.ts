export interface DetectStagehandAuthIssueInput {
  readonly bodyText: string;
  readonly requestedUrl: string;
  readonly response: Response;
}

export interface StagehandAuthIssue {
  readonly kind: 'login' | 'forbidden';
  readonly message: string;
}

const LOGIN_PATH_MARKERS = ['/auth/login', '/login'] as const;
const LOGIN_BODY_MARKERS = ['/auth/login', '?auth=login', 'login failed', 'sign in again', 'erneut anmelden'] as const;
const FORBIDDEN_BODY_MARKERS = ['forbidden', 'keine berechtigung', 'unzureichende berechtigungen', 'insufficient permissions'] as const;

function includesAnyMarker(value: string, markers: readonly string[]): boolean {
  return markers.some((marker) => value.includes(marker));
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function resolveLocationUrl(location: string, requestedUrl: string): URL | null {
  try {
    return new URL(location, requestedUrl);
  } catch {
    return null;
  }
}

function isLoginPath(pathname: string): boolean {
  return LOGIN_PATH_MARKERS.some((marker) => pathname.includes(marker));
}

export function detectStagehandAuthIssue({
  bodyText,
  requestedUrl,
  response,
}: DetectStagehandAuthIssueInput): StagehandAuthIssue | null {
  const normalizedBodyText = bodyText.toLowerCase();
  const location = response.headers.get('location');
  const responseUrl = response.url === '' ? requestedUrl : response.url;
  const normalizedResponseUrl = responseUrl.toLowerCase();

  if (response.status === 401) {
    return {
      kind: 'login',
      message: 'Login-Anforderung erkannt; der Pilotlauf bricht ab, statt eine Login-Schleife zu tolerieren.',
    };
  }

  if (response.status === 403) {
    return {
      kind: 'forbidden',
      message: 'Forbidden-Zustand erkannt; die Mission schlägt fehl.',
    };
  }

  if (location !== null && isRedirectStatus(response.status)) {
    const resolvedLocation = resolveLocationUrl(location, requestedUrl);
    const resolvedPath = resolvedLocation?.pathname.toLowerCase() ?? location.toLowerCase();

    if (isLoginPath(resolvedPath)) {
      return {
        kind: 'login',
        message: 'Login-Redirect erkannt; der Pilotlauf bricht ab, statt eine Login-Schleife zu tolerieren.',
      };
    }

    if (resolvedPath.includes('forbidden')) {
      return {
        kind: 'forbidden',
        message: 'Forbidden-Redirect erkannt; die Mission schlägt fehl.',
      };
    }
  }

  if (isLoginPath(new URL(responseUrl).pathname.toLowerCase()) || includesAnyMarker(normalizedResponseUrl, LOGIN_BODY_MARKERS)) {
    return {
      kind: 'login',
      message: 'Login-Zustand erkannt; der Pilotlauf bricht ab, statt eine Login-Schleife zu tolerieren.',
    };
  }

  if (includesAnyMarker(normalizedBodyText, LOGIN_BODY_MARKERS)) {
    return {
      kind: 'login',
      message: 'Login-Hinweise im HTML erkannt; der Pilotlauf bricht ab, statt eine Login-Schleife zu tolerieren.',
    };
  }

  if (normalizedResponseUrl.includes('forbidden') || includesAnyMarker(normalizedBodyText, FORBIDDEN_BODY_MARKERS)) {
    return {
      kind: 'forbidden',
      message: 'Forbidden-Zustand erkannt; die Mission schlägt fehl.',
    };
  }

  return null;
}
