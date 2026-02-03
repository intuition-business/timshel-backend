import passport from "passport";
import { OAuth2Strategy as GoogleStrategy } from "passport-google-oauth";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "../config";

const emails = ["urielmarciales@gmail.com"];

// Deserializa al usuario de la sesión. Busca al usuario (en este caso, por correo electrónico)

passport.use(
  "auth-google",
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:4000/api/auth/google",
    },
    function (
      accessToken: any,
      refreshToken: any,
      profile: any,
      done: (arg0: null, arg1: any) => void
    ) {
      const response = emails?.includes(profile.emails[0].value);
      if (response) {
        done(null, profile);
      } else {
        emails.push(profile.emails[0].value);
        done(null, profile);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user?.emails?.[0]?.value); // Guarda el correo electrónico en la sesión
});

passport.deserializeUser((user: any, done) => {
  done(null, user?.emails?.[0]?.value); // Guarda el correo electrónico en la sesión
});
