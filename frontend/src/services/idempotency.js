import { useState, useCallback } from "react";

// One key per payment attempt (PRD §39). Every try at the same payment (a double
// click, a retry after a timeout) sends the same key, so the server charges once.
// Call renew() after a payment goes through, so the next one is a new payment.
export function useIdempotencyKey() {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const renew = useCallback(() => setKey(crypto.randomUUID()), []);
  return [key, renew];
}

// axios config for a request carrying the key
export const withIdempotencyKey = (key) => ({ headers: { "Idempotency-Key": key } });
