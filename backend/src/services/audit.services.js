// Admin audit log (PRD §39). Call inside the prisma.$transaction that makes the
// change, so the change and its entry are saved together or not at all.
export function logAdminAction(tx, adminId, { action, targetType, targetId, summary, details }) {
    return tx.adminAuditLog.create({
        data: { adminId, action, targetType, targetId, summary, details },
    })
}

// IN_PROGRESS -> "in progress", for the readable summary line
export const statusText = (status) => status.toLowerCase().replace(/_/g, " ")

// { field: { from, to } } for every field in `next` that differs from `prev`
export function changedFields(prev, next) {
    return Object.fromEntries(
        Object.entries(next)
            .filter(([key, value]) => value !== undefined && value !== prev[key])
            .map(([key, value]) => [key, { from: prev[key], to: value }])
    )
}
