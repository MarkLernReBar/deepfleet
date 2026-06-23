import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { fleetRouter } from "./fleetRouter";
import { seedDemoData, seedBuiltinTools } from "./seed";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  fleet: fleetRouter,
  seed: router({
    // Seeds builtin tools and demo data for the current user. Idempotent for tools.
    run: protectedProcedure.mutation(async ({ ctx }) => {
      await seedBuiltinTools(ctx.user.id);
      const result = await seedDemoData(ctx.user.id);
      return result;
    }),
  }),
});

export type AppRouter = typeof appRouter;
