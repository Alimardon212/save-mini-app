export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "*",   // Barcha domenlardan ruxsat
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response("OK", { headers });
    }

    if (request.method !== "POST") {
      return new Response("Only POST allowed", { status: 405, headers });
    }

    try {
      const data = await request.json();
      const userId = data.user?.id || Date.now();

      await env.DATA.put(`user_${userId}`, JSON.stringify(data));

      return new Response("Saved", { status: 200, headers });
    } catch (err) {
      return new Response("Error: " + err.message, { status: 500, headers });
    }
  }
};
