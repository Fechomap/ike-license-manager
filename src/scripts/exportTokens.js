// src/scripts/exportTokens.js
require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Token = require('../models/tokenModel');
const config = require('../config/config');

async function exportTokens() {
    try {
        const scriptsDir = path.join(__dirname, 'data');
        await fs.mkdir(scriptsDir, { recursive: true });

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(config.mongodbURI);
            console.log('✅ Conectado a MongoDB');
        }

        const tokens = await Token.find({}).lean();
        console.log(`📊 Encontrados ${tokens.length} tokens`);

        // Función para formatear fecha en formato "DD/MM/YYYY, HH:MM:SS a.m./p.m."
        const formatDate = (date) => {
            if (!date) return '';
            if (!(date instanceof Date)) {
                date = new Date(date);
            }
            if (isNaN(date.getTime())) return '';

            const hours = date.getHours();
            const minutes = date.getMinutes();
            const seconds = date.getSeconds();
            
            // Determinar si es AM o PM
            const period = hours >= 12 ? 'p.m.' : 'a.m.';
            
            // Convertir a formato 12 horas
            let hour12 = hours % 12;
            hour12 = hour12 || 12; // 0 debería ser 12 en formato 12 horas

            return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}, ` +
                   `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${period}`;
        };

        const excelData = tokens.map(token => ({
            'Token': token.token || '',
            'Email': token.email || '',
            'Nombre': token.name || '',
            'Teléfono': token.phone || '',
            'Fecha_Creación': formatDate(token.createdAt),
            'Fecha_Expiración': formatDate(token.expiresAt),
            'Estado': token.isRedeemed ? 'Canjeado' : 'No Canjeado',
            'Fecha_Canje': formatDate(token.redeemedAt),
            'ID_Máquina': token.machineId || '',
            'IP_Redención': token.redemptionDetails?.ip || '',
            'Dispositivo_Redención': token.redemptionDetails?.deviceInfo || '',
            'Timestamp_Redención': formatDate(token.redemptionDetails?.timestamp)
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // Ajustar anchos de columna
        worksheet['!cols'] = [
            { wch: 35 }, // Token
            { wch: 30 }, // Email
            { wch: 25 }, // Nombre
            { wch: 15 }, // Teléfono
            { wch: 25 }, // Fecha_Creación
            { wch: 25 }, // Fecha_Expiración
            { wch: 12 }, // Estado
            { wch: 25 }, // Fecha_Canje
            { wch: 20 }, // ID_Máquina
            { wch: 15 }, // IP_Redención
            { wch: 30 }, // Dispositivo_Redención
            { wch: 25 }  // Timestamp_Redención
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tokens');

        const filePath = path.join(scriptsDir, 'tokens_database.xlsx');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        await fs.writeFile(filePath, buffer);

        console.log(`✅ Base de datos exportada exitosamente a: ${filePath}`);
        
        await mongoose.connection.close();
        console.log('🔌 Conexión a MongoDB cerrada');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en la exportación:', error);
        process.exit(1);
    }
}

exportTokens();