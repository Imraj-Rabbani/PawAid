import { useEffect, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

// Loads Google's sign-in script once and shares it between pages
let scriptPromise;
const loadGoogleScript = () => {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

// Renders Google's own "Sign in with Google" button. onCredential gets the ID
// token Google returns, which the backend verifies. Renders nothing when no
// client id is configured.
const GoogleSignInButton = ({ onCredential, onError, text = 'signin_with' }) => {
  const containerRef = useRef(null);
  // the latest handlers, so the button isn't re-rendered on every parent render
  const handlers = useRef({ onCredential, onError });
  useEffect(() => {
    handlers.current = { onCredential, onError };
  });

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => handlers.current.onCredential(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          width: containerRef.current.offsetWidth || 320,
        });
      })
      .catch((error) => handlers.current.onError?.(error.message));

    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-sm text-gray-500">or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div ref={containerRef} className="flex justify-center min-h-11" />
    </>
  );
};

export default GoogleSignInButton;
