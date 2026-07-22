import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AdminConfig } from './config';

export class AuthorizationError extends Error {}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function verifyCloudflareAccess(request: Request, config: AdminConfig): Promise<JWTPayload> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new AuthorizationError('Cloudflare Access authorization is required.');

  let keySet = keySets.get(config.accessTeamDomain);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${config.accessTeamDomain}/cdn-cgi/access/certs`));
    keySets.set(config.accessTeamDomain, keySet);
  }

  try {
    const result = await jwtVerify(token, keySet, {
      issuer: config.accessTeamDomain,
      audience: config.accessAudience,
    });
    return result.payload;
  } catch {
    throw new AuthorizationError('Cloudflare Access authorization is invalid or expired.');
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) {
    throw new AuthorizationError('The content change request did not come from this site.');
  }
}
