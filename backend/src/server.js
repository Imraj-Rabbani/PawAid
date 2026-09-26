import express from "express";
import env from "./config/env.js";
import { prisma } from "./db.js";
import cors from "cors"
import routes from "./routes/index.js";

const app = express();
app.use(cors())
app.use(express.json());

app.use("/api", routes)

app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});