import { createTRPCRouter } from '../../create-context';
import { signUpProcedure } from './sign-up';
import { signInProcedure } from './sign-in';
import { sendOtpProcedure } from './send-otp';
import { verifyOtpProcedure } from './verify-otp';
import { oauthSignInProcedure } from './oauth-sign-in';
import { requestPasswordResetProcedure } from './request-password-reset';
import { resetPasswordProcedure } from './reset-password';

export const authRouter = createTRPCRouter({
  signUp: signUpProcedure,
  signIn: signInProcedure,
  sendOtp: sendOtpProcedure,
  verifyOtp: verifyOtpProcedure,
  oauthSignIn: oauthSignInProcedure,
  requestPasswordReset: requestPasswordResetProcedure,
  resetPassword: resetPasswordProcedure,
});
