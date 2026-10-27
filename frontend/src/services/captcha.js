// Cloudflare Turnstile site key. Without it there is no CAPTCHA widget, and the
// backend skips the check too (TURNSTILE_SECRET_KEY unset).
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export const isCaptchaEnabled = Boolean(TURNSTILE_SITE_KEY);
