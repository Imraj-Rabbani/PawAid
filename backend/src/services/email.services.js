import env from "../config/env.js"

// Sends through Resend's HTTP API (https://resend.com, free tier is 100 emails a day).
// Without a verified domain, Resend only delivers from onboarding@resend.dev to the
// address the Resend account was created with, which is enough for alerts to ourselves.
export async function sendEmail({ to, subject, text }) {
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set")

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: env.ALERT_EMAIL_FROM, to, subject, text }),
        signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`)
}
