import { useLocation } from 'react-router-dom';

const PORTALS = ['/admin', '/sales', '/team', '/client'] as const;

/**
 * Returns the current portal prefix based on the URL — '/admin', '/sales',
 * '/team', or '/client'. Use this when building links or navigate() targets
 * inside shared page components so they stay within the user's portal.
 */
export function usePortalBase(): string {
  const { pathname } = useLocation();
  for (const p of PORTALS) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return p;
  }
  // Legacy paths — these are forwarded by the router but may appear briefly
  if (pathname === '/emp' || pathname.startsWith('/emp/')) return '/team';
  if (pathname === '/client-portal' || pathname.startsWith('/client-portal/')) return '/client';
  if (pathname === '/portal' || pathname.startsWith('/portal/')) return '/client';
  return '/admin';
}
