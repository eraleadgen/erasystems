import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Signed-in calls from an unverified device are refused server side; send the
  // person to the email-code page and bring them back afterwards.
  const onDeviceError = (error: unknown) => {
    if (typeof window === "undefined") return;
    if (!(error instanceof Error) || !error.message.includes("DEVICE_VERIFICATION_REQUIRED")) return;
    if (window.location.pathname.startsWith("/verify-device")) return;
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/verify-device?next=${encodeURIComponent(next)}`);
  };
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: onDeviceError }),
    mutationCache: new MutationCache({ onError: onDeviceError }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
