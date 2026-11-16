import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { isAllowedClientOrigin } from "../config/origins.js";
import { DemoEnquiry } from "../models/index.js";

export const demoEnquirySchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().max(254).toLowerCase().pipe(z.email()),
  company: z.string().trim().max(150).optional(),
  website: z.union([z.literal(""), z.string().url().max(2000).refine(value => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  }, "Use an HTTP(S) website URL without credentials")]).optional(),
  interest: z.enum(["Website monitoring", "API health checks", "Alerts and incidents", "Full platform demo", "Other enquiry"]),
  message: z.string().trim().min(10).max(5000),
}).strict();

export const demoEnquiryRouter = Router();
demoEnquiryRouter.post("/demo-enquiries", rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
  if (!isAllowedClientOrigin(req.headers.origin)) {
    res.status(403).json({ error: { code: "INVALID_ORIGIN", message: "Request origin is not allowed" } }); return;
  }
  const input = demoEnquirySchema.parse(req.body);
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: { code: "DATABASE_UNAVAILABLE", message: "We cannot save your enquiry right now. Please try again later." } }); return;
  }
  await DemoEnquiry.create(input);
  res.status(201).json({ data: { success: true } });
});

