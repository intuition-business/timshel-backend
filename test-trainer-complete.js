const http = require('http');
const jwt = require('jsonwebtoken');

// Secreto del JWT (debe coincidir con el del proyecto)
const SECRET = process.env.SECRET_KEY_JWT || 'SECRET.321';

// Generar un token JWT válido con un userId
const token = jwt.sign(
    { userId: 1, email: 'admin@example.com', rol: 'admin' },
    SECRET,
    { expiresIn: '1h' }
);

console.log('🔐 Token JWT Admin generado: ' + token.substring(0, 50) + '...\n');

// Datos para la prueba: Crear entrenador NUEVO (con timestamp para garantizar unicidad)
const timestamp = Date.now();
const testData = {
    name: `Entrenador Test ${timestamp}`,
    email: `trainer${timestamp}@example.com`,
    phone: `+57310${String(timestamp).slice(-6)}`,
    description: 'Entrenador de prueba',
    address: 'Bogotá, Colombia',
    goal: 'Ganar masa muscular',
    rating: 4.5,
    experience_years: 5
};

console.log('📝 PRUEBA COMPLETA: Crear Entrenador → Validar OTP → Obtener Token\n');
console.log('Datos del entrenador a crear:');
console.log(JSON.stringify(testData, null, 2));
console.log('\n' + '='.repeat(70) + '\n');

// Función para hacer petición
function makeRequest(method, path, data = null, customHeaders = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 4000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...customHeaders
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: responseData
                });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Función principal asincrónica
(async () => {
    try {
        // ============================================
        // PASO 1: CREAR ENTRENADOR
        // ============================================
        console.log('PASO 1️⃣: Creando entrenador...\n');

        const createResponse = await makeRequest(
            'POST',
            '/api/trainers/create',
            testData,
            { 'x-access-token': token }
        );

        console.log(`Status: ${createResponse.status}`);
        let otpCode = null;
        let otpResponse = null;

        if (createResponse.status === 200) {
            otpResponse = JSON.parse(createResponse.body);
            console.log('✅ Entrenador creado exitosamente');
            console.log('Response:', JSON.stringify(otpResponse, null, 2));

            if (otpResponse.code) {
                otpCode = otpResponse.code;
                console.log(`\n🔐 OTP capturado: ${otpCode}`);
            }
        } else {
            console.log('❌ Error al crear entrenador');
            console.log('Response:', createResponse.body);
            return;
        }

        console.log('\n' + '='.repeat(70) + '\n');

        // ============================================
        // PASO 2: VALIDAR OTP
        // ============================================
        console.log('PASO 2️⃣: Validando OTP...\n');

        if (!otpCode) {
            console.log('❌ No se obtuvo código OTP');
            return;
        }

        const validateOtpData = {
            email: testData.email,
            otp: parseInt(otpCode) // Convertir a número (no string)
        };

        console.log('Enviando datos de validación:');
        console.log(JSON.stringify(validateOtpData, null, 2));

        const validateResponse = await makeRequest(
            'POST',
            '/api/validate-otp',
            validateOtpData,
            {}
        );

        console.log(`\nStatus: ${validateResponse.status}`);

        if (validateResponse.status === 200) {
            const validateResult = JSON.parse(validateResponse.body);
            console.log('✅ OTP validado exitosamente');
            console.log('Response:', JSON.stringify(validateResult, null, 2));

            if (validateResult.token) {
                console.log(`\n🎉 TOKEN DE ENTRENADOR OBTENIDO`);
                console.log(`Token: ${validateResult.token.substring(0, 50)}...`);
                console.log(`Tipo: ${validateResult.type || 'trainer'}`);

                // Decodificar el token para ver su contenido
                try {
                    const decoded = jwt.decode(validateResult.token);
                    console.log('\n📋 Contenido del token (sin verificar firma):');
                    console.log(JSON.stringify(decoded, null, 2));
                } catch (err) {
                    console.log('No se pudo decodificar el token');
                }
            }
        } else {
            console.log('❌ Error al validar OTP');
            console.log('Response:', validateResponse.body);
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ PRUEBA COMPLETADA EXITOSAMENTE');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
})();
