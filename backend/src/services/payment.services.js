import { randomUUID } from "node:crypto";

// Methods paid outside PawAid (PRD §15). The wallet is not here: wallet payments
// never leave the platform and go through wallet.services.js instead.
export const EXTERNAL_METHODS = ["BKASH", "NAGAD", "CARD"]

// Not used at the moment: checkout offers cash on delivery and the wallet only.
// Kept for when online payments are switched back on.
//
// Simulated payment provider. Every charge succeeds straight away and no money is
// collected, like the dummy wallet top up. A real gateway (SSLCommerz, PRD §23)
// replaces this: it would start a hosted payment session, and the order would only
// be confirmed from the gateway's callback, refunding if the order then failed.
export async function chargeExternal({ method, amount }) {
    if (!EXTERNAL_METHODS.includes(method)) throw new Error(`Unsupported payment method: ${method}`)
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Charge amount must be a positive whole number")

    return { status: "COMPLETED", reference: `SIM-${method}-${randomUUID().slice(0, 8).toUpperCase()}` }
}
