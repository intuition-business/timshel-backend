import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import passport from "passport";
import session from "express-session";
import swaggerUi from "swagger-ui-express";
import { router } from "./../router";
import {
  cosrsOptions,
  handleErrors,
  logErrors,
  boomHandleErrors,
  ormHandlerError,
} from "../middleware";
import { conectionMysql } from "./../infrastructure/database";
import { NODE_ENV, PORT, URL } from "../config";
import { openapiSpecification } from "../infrastructure/swagger";
import cron from 'node-cron';
import { renewRoutines } from "../application/routineDays/controller";

const Server = () => {
  const app: Application = express();

  //createRole();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(helmet());
  //app.use(cors());

  app.use(
    session({
      secret: "EXPRESS_SESSION", // ¡Reemplaza esto con una clave secreta fuerte!
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Solo habilitar en producción con HTTPS
        maxAge: 24 * 60 * 60 * 1000, // Ejemplo: 24 horas de duración de la sesión
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/", (req, res) => {
    res.json({
      auth: "on",
      version: "alpha",
    });
  });

  const listen = () => {
    try {
      router(app);
      conectionMysql();
      // connectionMongo();
      app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpecification));
      app.use(logErrors);
      app.use(ormHandlerError);
      app.use(boomHandleErrors);
      app.use(handleErrors);

      app.listen(PORT, () => {
        console.log(`NODE_ENV=${NODE_ENV}`);
        console.log(`CORS-enabled web server listening on port ${PORT}`);
        console.log(`Run app in ${URL}:${PORT}`);

        cron.schedule('38 18 * * *', async () => {
          console.log("Ejecutando renovación de rutinas...");
          await renewRoutines();
        }, {
          timezone: 'America/Bogota'
        });
      });
    } catch (error) {
      console.log("Error:", error);
    }
  };
  listen();
};

export default Server;
