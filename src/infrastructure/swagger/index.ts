import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Timshell",
      version: "1.0.0",
      description: "Una descripción de mi increíble API",
    },
  },
  apis: [path.join(__dirname, "./*.ts")],
};

export const openapiSpecification = swaggerJsdoc(options);
