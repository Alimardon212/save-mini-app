export default {
  async fetch(req, env) {
    if (req.method !== "POST") {
      return new Response("Only POST allowed", { status: 405 });
    }

    try {
      const body = await req.json();

      const {
        userId,
        answers,
        submittedAt
      } = body;

      if (!userId || !answers) {
        return new Response("Invalid data", { status: 400 });
      }

      const key = `user:${userId}`;

      await env.ANSWERS_KV.put(
        key,
        JSON.stringify({
          userId,
          answers,
          submittedAt
        })
      );

      return new Response(JSON.stringify({
        ok: true
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (e) {
      return new Response("Error: " + e.message, { status: 500 });
    }
  }
};
