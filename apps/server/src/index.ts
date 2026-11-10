const server = Bun.serve({
  port: Number(process.env.PORT || 3001),
  hostname: "0.0.0.0",
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, game: "realms-unwritten" });
    return new Response("Realms Unwritten prototype server", { status: 200 });
  },
});
console.log(`Realms Unwritten server listening on ${server.url}`);
