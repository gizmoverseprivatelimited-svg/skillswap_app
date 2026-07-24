import { router } from "../../create-context";
import { sendMessageProcedure } from "./send-message";
import { fetchMessagesProcedure } from "./fetch-messages";

export const chatRouter = router({
  sendMessage: sendMessageProcedure,
  fetchMessages: fetchMessagesProcedure,
});
