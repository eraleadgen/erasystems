// TEMPORARY diagnostic. Delete after the hostname trust model is measured.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hdrprobe')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers: Record<string, string> = {}
        request.headers.forEach((v, k) => {
          headers[k] = v
        })
        return new Response(JSON.stringify({ url: request.url, headers }, null, 2), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  },
})
