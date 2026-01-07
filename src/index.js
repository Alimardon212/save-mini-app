export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Only POST allowed", { status: 405 });
    }

    try {
      const data = await request.json(); // JSON ni olish
      const userId = data.user?.id || Date.now();

      await env.DATA.put(`user_${userId}`, JSON.stringify(data));

      return new Response("Saved", { status: 200 });
    } catch (err) {
      return new Response("Error: " + err.message, { status: 500 });
    }
  }
};
