// src/scripts/importTokens.js
require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Token = require('../models/tokenModel');
const config = require('../config/config');

async function importTokens() {
    try {
        const scriptsDir = path.join(__dirname, 'data');
        const filePath = path.join(scriptsDir, 'tokens_database.xlsx');

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(config.mongodbURI);
            console.log('✅ Conectado a MongoDB');
        }

        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`📊 Leyendo ${data.length} registros del archivo`);

        const results = {
            total: data.length,
            updated: 0,
            errors: []
        };

        // Función para parsear fecha con formato "DD/MM/YYYY, HH:MM:SS a.m./p.m."
        const parseDate = (dateStr) => {
            if (!dateStr) return null;

            // Regex para el formato específico
            const regex = /(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(a\.m\.|p\.m\.)/i;
            const match = dateStr.match(regex);

            if (!match) {
                throw new Error(`Formato de fecha no reconocido: ${dateStr}`);
            }

            const [, day, month, year, hours, minutes, seconds, period] = match;
            
            // Convertir a formato 24 horas
            let hour = parseInt(hours);
            if (period.toLowerCase() === 'p.m.' && hour !== 12) {
                hour += 12;
            } else if (period.toLowerCase() === 'a.m.' && hour === 12) {
                hour = 0;
            }

            // Crear objeto Date
            return new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                hour,
                parseInt(minutes),
                parseInt(seconds)
            );
        };

        for (const row of data) {
            try {
                // Verificar que el token existe
                if (!row.Token) {
                    continue;
                }

                let expiresAt;
                try {
                    expiresAt = parseDate(row.Fecha_Expiración);
                    if (!expiresAt || isNaN(expiresAt.getTime())) {
                        throw new Error(`Fecha inválida: ${row.Fecha_Expiración}`);
                    }
                } catch (error) {
                    results.errors.push(`Error en fecha para token ${row.Token}: ${error.message}`);
                    continue;
                }

                // Actualizar solo la fecha de expiración
                const result = await Token.updateOne(
                    { token: row.Token },
                    { 
                        $set: { 
                            expiresAt: expiresAt
                        }
                    }
                );

                if (result.modifiedCount > 0) {
                    results.updated++;
                    console.log(`✅ Actualizado token: ${row.Token}`);
                }
            } catch (error) {
                results.errors.push(`Error procesando token ${row.Token}: ${error.message}`);
            }
        }

        console.log('\n📊 Resultados de la importación:');
        console.log(`Total de registros: ${results.total}`);
        console.log(`Tokens actualizados: ${results.updated}`);
        
        if (results.errors.length > 0) {
            console.log('\n❌ Errores encontrados:');
            results.errors.forEach(error => console.log(`- ${error}`));
        }

        await mongoose.connection.close();
        console.log('\n🔌 Conexión a MongoDB cerrada');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en la importación:', error);
        process.exit(1);
    }
}

importTokens();