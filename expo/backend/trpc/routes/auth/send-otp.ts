import { publicProcedure } from '../../create-context';
import { z } from 'zod';
import { generateOTP, storeOTP } from '../../../lib/otp';

export const sendOtpProcedure = publicProcedure
  .input(
    z.object({
      identifier: z.string().min(5),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[SendOTP] Sending OTP to:', input.identifier);

    const code = generateOTP();
    storeOTP(input.identifier, code);

    console.log('[SendOTP] Development OTP code:', code);

    return {
      success: true,
      message: `OTP sent to ${input.identifier}`,
      devCode: process.env.NODE_ENV === 'development' ? code : undefined,
    };
  });
