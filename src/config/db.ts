import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const dbConfig: any = {
  host: process.env.HOST || "", // Tu host de MariaDB
  user: process.env.USER_DB || "", // Tu usuario de MariaDB
  password: process.env.PASSWORD_DB || "", // Tu contraseña de MariaDB
  database: process.env.DATABASE || "", // El nombre de tu base de datos
  port: process.env.PORT_DB || "",
};

const pool = mysql.createPool(dbConfig);

export default pool;
