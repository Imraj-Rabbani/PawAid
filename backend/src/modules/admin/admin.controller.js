import { prisma } from "../../db"


export async function getStats(req, res) {
    try {
        const [users, volunteers] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { role: "VOLUNTEER" } }),
        ])

        return res.json({
            message: "Stats fetched",
            data: { users, volunteers }
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
}
