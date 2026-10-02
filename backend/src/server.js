import express from "express";
import env from "./config/env.js";
import cors from "cors"
import routes from "./routes/index.js";

const app = express();
app.use(cors({
  origin: env.CORS_ORIGIN
}))
app.use(express.json());

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

app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});
