import "dotenv/config";
import express from "express";

import { prisma } from "./db.js";

const app = express();

app.use(express.json());

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password,
      },
    });

    return res.status(201).json({
      message: "Signed up successfully",
      user,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});