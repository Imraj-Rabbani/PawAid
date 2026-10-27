import env from "./config/env.js";
import app from "./app.js";
import { cleanupIdempotencyKeys } from "./middleware/idempotency.middleware.js";
import { startR2UsageGuard } from "./services/r2Usage.services.js";
import { isCaptchaEnabled } from "./services/captcha.services.js";

app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});

// payment retry keys only need to live a day
cleanupIdempotencyKeys()
setInterval(cleanupIdempotencyKeys, 60 * 60 * 1000).unref()

// emails and pauses uploads before R2 goes past the free tier
startR2UsageGuard()

if (!isCaptchaEnabled()) {
  console.warn("TURNSTILE_SECRET_KEY not set, sign in and sign up have no CAPTCHA")
}
