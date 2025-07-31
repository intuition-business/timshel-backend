import { CorsOptions } from "cors";

const cosrsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Para permitir todos los orígenes (incluyendo mobile apps que podrían no enviar 'origin')
    callback(null, true);
    // O si quieres whitelist específica:
    // const whiteList = ['http://tu-dominio.com', 'http://localhost'];
    // if (!origin || whiteList.includes(origin)) {
    //   callback(null, true);
    // } else {
    //   callback(new Error("Access denied - CORS policy"));
    // }
  },
  methods: ["GET", "POST", "UPDATE", "DELETE", "PUT", "PATCH", "OPTIONS"], // Agrega OPTIONS para preflights
  allowedHeaders: ["Content-Type", "Authorization"], // Agrega si usas headers custom
  credentials: true, // Si usas cookies/sesiones
};

export default cosrsOptions;
