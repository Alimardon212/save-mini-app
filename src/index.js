export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
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

      // Kalit sifatida faqat userId
      const userId = data.userId || Date.now();

      await env.DATA.put(`${userId}`, JSON.stringify(data));

      return new Response("Saved", { status: 200, headers });
    } catch (err) {
      return new Response("Error: " + err.message, { status: 500, headers });
    }
  }
};
