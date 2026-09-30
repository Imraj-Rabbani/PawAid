export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: "Not Authorized" })
    }

    if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Admin access required" })
    }

    next()
}