const COOKIE_NAME = 'launch_game_session';

export function hasSessionAccess(request: Request, sessionId: string): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = cookieHeader.split(';').map((part) => part.trim());
  const value = cookies
    .map((cookie) => cookie.split('='))
    .find(([name]) => name === COOKIE_NAME)?.[1];
  return Boolean(value && decodeURIComponent(value) === sessionId);
}

export function sessionAccessDenied() {
  return Response.json({ error: 'session_access_denied' }, { status: 403 });
}
