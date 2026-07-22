import { redirectsSchema } from "../src/domain/redirects";
import { readAdminConfig, type AdminEnv } from "./lib/config";
import { readGlobal } from "./lib/global-repository";
import { createGitHubClient } from "./lib/github";
import type { PagesContext } from "./lib/runtime";

type MiddlewareContext = PagesContext<AdminEnv> & { next(): Promise<Response> };

export function resolveRedirect(
  requestUrl: URL,
  redirects: ReturnType<typeof redirectsSchema.parse>,
): { location: string; status: 301 | 302 | 307 | 308 } | undefined {
  const requestPath = requestUrl.pathname.replace(/\/$/, "") || "/";
  const match = redirects.redirects.find(
    (redirect) => redirect.from === requestPath,
  );
  if (!match) return undefined;
  const destination = new URL(match.to, requestUrl.origin);
  if (match.preserveQuery) {
    requestUrl.searchParams.forEach((value, key) => {
      if (!destination.searchParams.has(key))
        destination.searchParams.append(key, value);
    });
  }
  return { location: destination.href, status: match.status };
}

export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const url = new URL(context.request.url);
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    /\.[a-z0-9]+$/i.test(url.pathname)
  )
    return context.next();
  try {
    const config = readAdminConfig(context.env);
    const result = await readGlobal(
      createGitHubClient(config),
      config,
      "redirects",
    );
    const redirects = redirectsSchema.parse(result.data);
    const redirect = resolveRedirect(url, redirects);
    if (!redirect) return context.next();
    return Response.redirect(redirect.location, redirect.status);
  } catch {
    return context.next();
  }
}
