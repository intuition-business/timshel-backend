import { CorsOptions } from "cors";

const whiteList = [""];

const cosrsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || whiteList.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("access denied - CORS-disabled to white list"));
    }
  },
  methods: ["GET", "POST", "DELETE", "UPDATE", "PUT", "PATCH"],
};

export default cosrsOptions;
