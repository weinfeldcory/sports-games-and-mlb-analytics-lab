import { createAppServer } from "./app.js";

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";

createAppServer().listen(port, host, () => {
  console.log(`Busy March Madness server running at http://${host}:${port}/`);
});
