export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      // Placeholder for the future backend (AI calls, saved responses, forms).
      // Future /api/jira landing spot — design reference: docs/jira-integration-spike-findings.md.
      return new Response(JSON.stringify({ error: "API not implemented yet" }), {
        status: 501,
        headers: { "content-type": "application/json" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
