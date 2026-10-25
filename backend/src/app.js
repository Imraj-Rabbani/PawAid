import express from "express";
import env from "./config/env.js";
import cors from "cors"
import routes from "./routes/index.js";
import { requireCsrfHeader } from "./middleware/csrf.middleware.js";

// The Express app without app.listen, so tests can drive it with supertest.
// server.js starts it.
const app = express();
app.set("trust proxy", env.TRUST_PROXY)
app.use(cors({
  origin: env.CORS_ORIGIN,
  // lets the browser send and receive the login cookie
  credentials: true,
}))
app.use(express.json());
app.use(requireCsrfHeader)

app.use("/api", routes)

app.use((err, req, res, next) => {
  const isUploadError = err.name === "MulterError"
  const status = isUploadError ? 400 : err.statusCode || err.status || 500

  if (status >= 500) console.error(err)

  // multer reports more files than a route allows as an "unexpected field"
  const message = err.code === "LIMIT_UNEXPECTED_FILE" ? "Too many files uploaded" : err.message

  res.status(status).json({
    message: status >= 500 ? "Something went wrong" : message
  })
})

export default app;
