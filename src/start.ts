import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {

    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
/**
 * Signed-in server calls only run from a device verified by emailed code
 * (remembered for up to 30 days). Anonymous calls are untouched.
 */
const deviceTrustMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const auth = request?.headers.get("authorization") ?? "";
  if (request && auth.startsWith("Bearer ")) {
    const t = await import("./lib/device-trust.server");
    const sub = t.jwtSubject(auth.slice(7));
    if (sub && !t.deviceTrustedFor(t.readCookie(request, t.DEVICE_COOKIE), sub)) {
      throw new Error(t.DEVICE_REQUIRED);
    }
  }
  return next();
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, deviceTrustMiddleware],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
