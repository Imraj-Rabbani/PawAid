// Request body validation. Put validateBody(schema) on the route, after
// requireAuth / upload / requireIdempotencyKey and before the controller:
//   - invalid: 400 { message: "Validation failed", errors: { field: [messages] } }
//   - valid:   req.body is replaced with the parsed data, so the controller gets
//              trimmed, coerced and defaulted values and none of the fields the
//              schema doesn't list
// The schemas live in src/schemas, one file per module.
export const validateBody = (schema) => (req, res, next) => {
    const parsed = schema.safeParse(req.body ?? {})
    if (!parsed.success) {
        return res.status(400).json({
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors,
        })
    }

    req.body = parsed.data
    next()
}
