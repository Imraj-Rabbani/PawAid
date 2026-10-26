import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import env from "../../config/env.js";
import { prisma } from "../../db.js";
import { sendEmail } from "../../services/email.services.js";
import { endAllSessions, findUser } from "./auth.services.js";

const RESET_LINK_LIFETIME = 30 * 60 * 1000

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex")

// Emails a reset link if the email belongs to an active account, and does nothing
// otherwise; the caller answers the same either way. Works for Google-only accounts
// too: owning the inbox is the same proof Google sign-in relies on, so they can add a password.
export async function requestPasswordReset(email) {
    const user = await findUser(email)
    if (!user || user.status !== "ACTIVE") return

    const token = crypto.randomBytes(32).toString("base64url")

    // a new link replaces any earlier one, so only the latest email works
    await prisma.$transaction([
        prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
        prisma.passwordReset.create({
            data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_LINK_LIFETIME) },
        }),
    ])

    // in the fragment, not the query string, so the token isn't sent to any server
    // (ours or the host's logs) or leaked in a Referer header
    const link = `${env.APP_URL}/reset-password#token=${token}`

    await sendEmail({
        to: user.email,
        subject: "Reset your PawAid password",
        text: `Hi ${user.name},\n\n` +
            `Someone asked to reset the password for your PawAid account. Open this link to choose a new one:\n\n${link}\n\n` +
            `The link works once and expires in 30 minutes. If you didn't ask for this, ignore this email; your password hasn't changed.`,
    })
}

// Sets the new password and signs the account out everywhere, in case the reset
// is because someone else got in. Returns false if the link is unknown, used or expired.
export async function resetPassword(token, password) {
    const reset = await prisma.passwordReset.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: true },
    })
    if (!reset || reset.expiresAt <= new Date() || reset.user.status !== "ACTIVE") return false

    const hashedPassword = await bcrypt.hash(password, 10)

    // deleting the row is what makes the link single use; if a second request with the
    // same token got here at the same time, only one delete finds the row
    return prisma.$transaction(async (tx) => {
        const { count } = await tx.passwordReset.deleteMany({ where: { id: reset.id } })
        if (count === 0) return false

        await tx.user.update({ where: { id: reset.userId }, data: { password: hashedPassword } })
        await tx.passwordReset.deleteMany({ where: { userId: reset.userId } })
        await endAllSessions(reset.userId, tx)
        return true
    })
}
