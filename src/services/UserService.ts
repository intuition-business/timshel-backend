import { OtpModel } from "../application/otp/model";



class UserService {
    constructor() { }

    async findByEmail(email: string): Promise<any[]> {
        const rows = await OtpModel.findByEmail(email);
        return (Array.isArray(rows) ? rows : []) as any[];
    }

    async createGoogleUser(data: { email: string; name?: string; picture?: string; rol?: string }) {
        const date = new Date();

        // Crea usuario en tabla usuarios
        const userResult = await OtpModel.createUser({
            nombre: data.name || "Google User",
            fecha_registro: date,
            planes_id: 0,
        });

        // Crea auth
        const authResult = await OtpModel.createAuth({
            usuario_id: userResult.insertId,
            entrenador_id: 0,
            email: data.email,
            rol: data.rol || "user",
            telefono: "",
            id_apple: 0,
            tipo_login: "google",
            name: data.name || "",
        });

        return { id: authResult.insertId };
    }
}

export default UserService;