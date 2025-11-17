// src/lib/server.js
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// === CORS (allow ONLY your frontend origin) ===
//const FRONTEND_ORIGIN = "https://event-management-system-zeta-blue.vercel.app";
app.use(cors());


// Basic rate limiting
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
  })
);

// Validate required envs
const REQUIRED = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "FROM_EMAIL"];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.warn(`Warning: env var ${k} is not set.`);
  }
}

// create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// verify transporter (non-blocking)
transporter.verify()
  .then(() => console.log("SMTP transporter verified"))
  .catch((err) => console.warn("SMTP verify failed (ok in dev):", err && err.message));

// simple email validator
function isValidEmail(e) {
  return typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// POST /api/send-otp expects { email, otp }
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ success: false, message: "email and otp required" });
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: "invalid email" });

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: process.env.OTP_SUBJECT || "Your 8-digit access code",
      text: `Your one-time access code is: ${otp}\n\nIt expires in 10 minutes.`,
      html: `<p>Your one-time access code is:</p><h2 style="letter-spacing:4px">${otp}</h2><p>Expires in 10 minutes.</p>`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Sent OTP to ${email}, messageId=${info.messageId}`);
    return res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    console.error("Error /api/send-otp:", err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

app.get("/api/health", (_, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`OTP server listening on port ${PORT}`);
  //console.log(`Accepting requests from FRONTEND_ORIGIN=${FRONTEND_ORIGIN}`);
});
