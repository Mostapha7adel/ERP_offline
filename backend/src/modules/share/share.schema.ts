import { z } from "zod";

export const shareRequestSchema = z.object({
  type: z.enum(["invoice", "statement"]),
  id: z.string().optional(),
  partyId: z.string().optional(),
  /** Email address to prefill (optional — client may leave blank). */
  to: z.string().email().optional().or(z.literal("")),
});

export const sharePayloadSchema = z.object({
  subject: z.string(),
  body: z.string(),
  /** mailto: link the client can open in the default mail app. */
  mailto: z.string(),
  /** https://wa.me link with the message prefilled. */
  whatsapp: z.string(),
});