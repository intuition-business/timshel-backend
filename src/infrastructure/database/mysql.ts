import pool from "../../config/db";

const conectionMysql = async () => {
  try {
    const [rows] = await pool.execute("SELECT 1");
    console.log("¡Conexión a la base de datos exitosa!");
  } catch (error) {
    console.error("Error al conectar a la base de datos:", error);
  } finally {
    // Opcional: Cierra la conexión si no la necesitas mantener activa inmediatamente
    // await pool.end();
  }
};

export default conectionMysql;
