export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Only POST allowed", { status: 405 });
    }

    const body = await request.json();

    const userId = body.user?.id;
    const initData = body.initData;

    if (!userId || !initData) {
      return new Response("Missing data", { status: 400 });
    }

    // KV ga saqlaymiz
    await env.DATA.put(
      `user_${userId}`,
      JSON.stringify({
        initData,
        time: Date.now()
      })
    );

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
};
