export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    const data = await request.json();

    return new Response(
      JSON.stringify({ status: "received", data }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
};

