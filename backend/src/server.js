import env from "./config/env.js";
import app from "./app.js";
import { cleanupIdempotencyKeys } from "./middleware/idempotency.middleware.js";

app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});

// payment retry keys only need to live a day
cleanupIdempotencyKeys()
setInterval(cleanupIdempotencyKeys, 60 * 60 * 1000).unref()
