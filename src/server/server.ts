
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
import { NODE_ENV, PORT, URL, SECRET } from "../config";  // Asegúrate de tener SECRET aquí
import { openapiSpecification } from "../infrastructure/swagger";
import cron from 'node-cron';
import { renewRoutines } from "../application/routineDays/controller";

// NUEVO: Importamos http
import { createServer } from "http";


import { initSocket } from "../socket/socket";

const Server = () => {
  const app: Application = express();

  const httpServer = createServer(app);
  const io = initSocket(httpServer);

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(helmet());
  app.use(cors());
  app.use(
    session({
      secret: "EXPRESS_SESSION",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,  // 1 día
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/", (req, res) => {
    res.json({ auth: "on", version: "alpha" });
  });

  // Exportamos io para usarlo en controladores si quieres
  (app as any).io = io;

  const listen = () => {
    try {
      router(app);
      conectionMysql();

      app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpecification));
      app.use(logErrors);
      app.use(ormHandlerError);
      app.use(boomHandleErrors);
      app.use(handleErrors);

      // CAMBIO CLAVE: ahora escucha httpServer, no app
      httpServer.listen(PORT, () => {
        console.log(`NODE_ENV=${NODE_ENV}`);
        console.log(`Server + Socket.IO corriendo en puerto ${PORT}`);
        console.log(`App: ${URL}:${PORT}`);

        cron.schedule('0 0 * * *', async () => {
          console.log("Ejecutando renovación de rutinas...");
          await renewRoutines();
        }, { timezone: 'America/Bogota' });
      });
    } catch (error) {
      console.log("Error:", error);
    }
  };

  listen();
};

export default Server;