// src/lib/origin-helpers.ts
// Utility to check allowed origins for API routes and server actions

const DEV_ALLOWED_HOSTS = [
  'localhost:3000',
  '127.0.0.1:3000',
  // Allow any Codespaces or cloud dev host
  ...((process.env.CODESPACE_NAME || process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN)
    ? [
        `${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`,
        `${process.env.CODESPACE_NAME}-3000.githubpreview.dev`,
      ]
    : []),
];

export function isOriginAllowed(origin: string | undefined, xForwardedHost: string | undefined): boolean {
  if (process.env.NODE_ENV === 'production') {
    // In production, require exact match to env var
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if (!siteUrl) return false;
    try {
      const url = new URL(siteUrl);
      return origin === url.origin && xForwardedHost === url.host;
    } catch {
      return false;
    }
  }
  // In dev, allow localhost and Codespaces hosts
  if (!origin || !xForwardedHost) return false;
  try {
    const originHost = new URL(origin).host;
    return (
      DEV_ALLOWED_HOSTS.includes(originHost) ||
      xForwardedHost === originHost ||
      xForwardedHost.endsWith('.github.dev') ||
      xForwardedHost.endsWith('.githubpreview.dev')
    );
  } catch {
    return false;
  }
}
