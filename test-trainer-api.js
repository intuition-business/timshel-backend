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

console.log('🔐 Token JWT generado:', token);
console.log('\n📝 Prueba 1: Crear entrenador VÁLIDO\n');

// Datos para la prueba 1: Crear entrenador válido
const testData1 = {
    name: 'Carlos Mendez',
    email: 'carlos.mendez@example.com',
    phone: '+573109876543',
    description: 'Entrenador certificado en fitness',
    address: 'Bogotá, Colombia',
    goal: 'Aumentar flexibilidad',
    rating: 4.5,
    experience_years: 8
};

// Función para hacer petición
function makeRequest(data, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 4000,
            path: '/api/trainers/create',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token,
                ...headers
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

        req.write(JSON.stringify(data));
        req.end();
    });
}

// Test 1: Crear entrenador válido
(async () => {
    try {
        console.log('Enviando datos:', JSON.stringify(testData1, null, 2));
        const response1 = await makeRequest(testData1);
        console.log(`✅ Status: ${response1.status}`);
        console.log('Response:', response1.body);

        console.log('\n⏳ Esperando 2 segundos antes de prueba 2...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: Intentar crear entrenador con MISMO EMAIL (debe fallar)
        console.log('📝 Prueba 2: Crear entrenador con EMAIL DUPLICADO (debe fallar)\n');
        const testData2 = {
            name: 'Otro Entrenador',
            email: 'carlos.mendez@example.com', // EMAIL DUPLICADO
            phone: '+573215555555',
            description: 'Otro entrenador',
            address: 'Medellín',
            goal: 'Resistencia',
            rating: 3,
            experience_years: 5
        };

        console.log('Enviando datos:', JSON.stringify(testData2, null, 2));
        const response2 = await makeRequest(testData2);
        console.log(`❌ Status: ${response2.status}`);
        console.log('Response:', response2.body);

        console.log('\n⏳ Esperando 2 segundos antes de prueba 3...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 3: Intentar crear entrenador con MISMO TELÉFONO (debe fallar)
        console.log('📝 Prueba 3: Crear entrenador con TELÉFONO DUPLICADO (debe fallar)\n');
        const testData3 = {
            name: 'Tercer Entrenador',
            email: 'otro.email@example.com',
            phone: '+573109876543', // TELÉFONO DUPLICADO
            description: 'Tercero',
            address: 'Cali',
            goal: 'Fuerza',
            rating: 4,
            experience_years: 3
        };

        console.log('Enviando datos:', JSON.stringify(testData3, null, 2));
        const response3 = await makeRequest(testData3);
        console.log(`❌ Status: ${response3.status}`);
        console.log('Response:', response3.body);

        console.log('\n✅ Pruebas completadas');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
})();
