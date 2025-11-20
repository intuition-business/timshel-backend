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

// NUEVO: Importamos http y socket.io
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

const Server = () => {
  const app: Application = express();

  // CREAMOS EL SERVIDOR HTTP Y SOCKET.IO
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*", // Cambia esto en producción
      methods: ["GET", "POST"]
    }
  });

  // Middlewares Express (igual que antes)
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(helmet());
  app.use(
    session({
      secret: "EXPRESS_SESSION",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/", (req, res) => {
    res.json({ auth: "on", version: "alpha" });
  });

  io.on("connection", (socket) => {
    console.log("Cliente conectado:", socket.id);
    socket.on("join-room", (room) => socket.join(room));
    socket.on("new-order", (data) => io.to("kitchen").emit("order-received", data));
    socket.on("disconnect", () => console.log("Cliente desconectado:", socket.id));
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