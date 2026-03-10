import { Router } from "express";
import { z } from "zod";
import { verifySignature } from "../middleware/verifySignature.js";
import { createChatReply } from "../services/chatService.js";

export const chatRouter = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().min(1).max(200),
  pageUrl: z.string().url().max(2000),
});

chatRouter.post("/", verifySignature, async (req, res, next) => {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const tenant = req.tenant;

    if (!tenant) {
      return res.status(500).json({
        error: "Tenant resolution failed",
      });
    }

    const reply = await createChatReply({
      tenant,
      message: parsed.data.message,
      pageUrl: parsed.data.pageUrl,
    });

    return res.status(200).json({ reply });
  } catch (error) {
    next(error);
  }
});