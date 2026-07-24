import { router } from "../../create-context";
import { registerPushTokenProcedure, unregisterPushTokenProcedure } from "./push-token";

export const notificationsRouter = router({
  registerPushToken: registerPushTokenProcedure,
  unregisterPushToken: unregisterPushTokenProcedure,
});
