import { useEffect, useImperativeHandle, useRef } from 'react';
import { TURNSTILE_SITE_KEY as SITE_KEY } from '../services/captcha';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Loads Cloudflare's Turnstile script once and shares it between pages
let scriptPromise;
const loadTurnstileScript = () => {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('Could not load the security check. Please refresh the page.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

// Cloudflare Turnstile's "are you human" check. It usually passes by itself;
// onToken gets the token to send with the form, or '' once it expires. A token
// works once, so call ref.current.reset() after a submit that didn't succeed.
const TurnstileWidget = ({ ref, action, onToken, onError }) => {
  const containerRef = useRef(null);
  const widgetId = useRef(null);
  // the latest handlers, so the widget isn't re-rendered on every parent render
  const handlers = useRef({ onToken, onError });
  useEffect(() => {
    handlers.current = { onToken, onError };
  });

  useImperativeHandle(ref, () => ({
    reset: () => {
      handlers.current.onToken('');
      if (widgetId.current !== null) window.turnstile.reset(widgetId.current);
    },
  }), []);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          action,
          callback: (token) => handlers.current.onToken(token),
          'expired-callback': () => handlers.current.onToken(''),
          'error-callback': () => handlers.current.onToken(''),
        });
      })
      .catch((error) => handlers.current.onError?.(error.message));

    return () => {
      cancelled = true;
      if (widgetId.current !== null) {
        window.turnstile?.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [action]);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="flex justify-center min-h-16.25" />;
};

export default TurnstileWidget;
