import { prisma } from "../db.js"


// Use after requireAuth. Checks the profile status, not just the role, so a
// revoked volunteer loses volunteer-only actions straight away.
export async function requireActiveVolunteer(req, res, next) {
    try {
        const volunteer = await prisma.volunteerProfile.findUnique({
            where: { userId: req.user.id },
        })

        if (!volunteer) {
            return res.status(403).json({ message: "Volunteer access required" })
        }

        if (volunteer.status !== "ACTIVE") {
            return res.status(403).json({ message: "Your volunteer status has been revoked" })
        }

        req.volunteer = volunteer
        next()
    } catch (error) {
        next(error)
    }
}
