/**
 * Vercel serverless entry.
 * Loads the esbuild bundle produced by `npm run build` (api/server.js).
 * Do NOT import ../src here — workspace packages point at .ts "main" and break on Node.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bundled = require("./server.js");
export default bundled.default || bundled;
