import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";

import { router } from "./../router";
import {
  cosrsOptions,
  handleErrors,
  logErrors,
  boomHandleErrors,
  ormHandlerError,
} from "../middleware";
import { connectionMongo } from "./../infrastructure/database";
import { NODE_ENV, PORT, URL } from "../config";
console.log({ NODE_ENV, PORT, URL });
// import { createRole } from "../libs/initialSetup";

const Server = () => {
  const app: Application = express();

  //createRole();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(helmet());
  app.use(cors(cosrsOptions));

  app.get("/", (req, res) => {
    res.json({
      auth: "on",
      version: "alpha",
    });
  });

  const listen = () => {
    try {
      router(app);
      connectionMongo();

      app.use(logErrors);
      app.use(ormHandlerError);
      app.use(boomHandleErrors);
      app.use(handleErrors);

      app.listen(PORT, () => {
        console.log(`NODE_ENV=${NODE_ENV}`);
        console.log(`CORS-enabled web server listening on port ${PORT}`);
        console.log(`Run app in ${URL}:${PORT}`);
      });
    } catch (error) {
      console.log("Error:", error);
    }
  };
  listen();
};

export default Server;
