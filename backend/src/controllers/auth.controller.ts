import crypto from "node:crypto";
import type { Request, Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "../config/env";
import { prisma } from "../config/database";

export function configurePassport() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(
              new Error("Google account did not provide an email"),
            );
          }

          const user = await prisma.user.upsert({
            where: { email },
            create: {
              googleId: profile.id,
              email,
              name: profile.displayName || email,
              avatar: profile.photos?.[0]?.value,
            },
            update: {
              googleId: profile.id,
              name: profile.displayName || email,
              avatar: profile.photos?.[0]?.value,
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      },
    ),
  );
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    done(null, user);
  } catch (error) {
    done(error);
  }
});

export function googleStart(
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
) {
  if (!env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({
      message: "Google OAuth is not configured",
    });
  }

  const state = crypto.randomBytes(32).toString("hex");

  req.session.oauthState = state;

  req.session.save((saveError) => {
    if (saveError) {
      console.error("OAuth state session save error:", saveError);
      return next(saveError);
    }

    console.log("OAUTH STATE SAVED:", {
      sessionID: req.sessionID,
      stateLength: state.length,
    });

    return passport.authenticate("google", {
      scope: ["profile", "email"],
      state,
    })(req, res, next);
  });
}

export function googleCallback(
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
) {
  const returnedState =
    typeof req.query.state === "string"
      ? req.query.state
      : undefined;

  const expectedState = req.session.oauthState;

  if (
    !returnedState ||
    !expectedState ||
    returnedState.length !== expectedState.length ||
    !crypto.timingSafeEqual(
      Buffer.from(returnedState),
      Buffer.from(expectedState),
    )
  ) {
    return res.redirect(
      `${env.FRONTEND_URL}/login?error=invalid_oauth_state`,
    );
  }

  delete req.session.oauthState;

  return passport.authenticate(
    "google",
    {
      failureRedirect: `${env.FRONTEND_URL}/login?error=oauth`,
    },
    (err: unknown, user: Express.User | false) => {
      if (err) {
        console.error("Google authentication error:", err);
        return next(err);
      }

      if (!user) {
        return res.redirect(
          `${env.FRONTEND_URL}/login?error=oauth`,
        );
      }

      req.session.regenerate((regenerateError) => {
        if (regenerateError) {
          console.error(
            "Session regeneration error:",
            regenerateError,
          );
          return next(regenerateError);
        }

        req.logIn(user, (loginError) => {
          if (loginError) {
            console.error("Passport login error:", loginError);
            return next(loginError);
          }

          req.session.save((saveError) => {
            if (saveError) {
              console.error(
                "Session save error:",
                saveError,
              );
              return next(saveError);
            }
            console.log("AUTH SESSION SAVED:", {
              sessionID: req.sessionID,
              userId: req.user?.id,});

            return res.redirect(
              `${env.FRONTEND_URL}/dashboard`,
            );
          });
        });
      });
    },
  )(req, res, next);
}

export function me(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      message: "Not authenticated",
    });
  }

  return res.json(req.user);
}

export function logout(req: Request, res: Response) {
  req.logout(() => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });
}