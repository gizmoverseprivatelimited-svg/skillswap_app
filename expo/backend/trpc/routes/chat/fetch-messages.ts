import { z } from "zod";
import { protectedProcedure } from "../../create-context";

export interface Message {
  id: string;
  swapId: string;
  authorId: string;
  body: string;
  createdAt: string;
  isSystem?: boolean;
}

export const messagesStore = new Map<string, Message[]>();

export const fetchMessagesProcedure = protectedProcedure
  .input(
    z.object({
      swapId: z.string(),
    })
  )
  .query(async ({ input }) => {
    const messages = messagesStore.get(input.swapId) ?? [];
    console.log("[Chat] Fetched messages", { swapId: input.swapId, count: messages.length });
    return { messages };
  });
