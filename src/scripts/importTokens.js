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
      created: 0,
      updated: 0,
      errors: [],
    };

    // Función para parsear fecha con formato "DD/MM/YYYY, HH:MM:SS a.m./p.m."
    const parseDate = (dateStr) => {
      if (!dateStr) {
        return null;
      }

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
        parseInt(seconds),
      );
    };

    for (const row of data) {
      try {
        // Verificar que el token existe en el archivo Excel
        if (!row.Token) {
          results.errors.push('Encontrada fila sin token');
          continue;
        }

        // Parsear las fechas
        let createdAt, expiresAt, redeemedAt;
        try {
          if (row.Fecha_Creación) {
            createdAt = parseDate(row.Fecha_Creación);
          } else {
            // Si no hay fecha de creación, usar la actual
            createdAt = new Date();
          }

          if (row.Fecha_Expiración) {
            expiresAt = parseDate(row.Fecha_Expiración);
          } else {
            // Si no hay fecha de expiración, crear una por defecto (90 días)
            expiresAt = new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000);
          }

          if (row.Fecha_Canje) {
            redeemedAt = parseDate(row.Fecha_Canje);
          }

          // Verificar que las fechas son válidas
          if (
            (createdAt && isNaN(createdAt.getTime())) ||
            (expiresAt && isNaN(expiresAt.getTime())) ||
            (redeemedAt && isNaN(redeemedAt.getTime()))
          ) {
            throw new Error('Una o más fechas no son válidas');
          }
        } catch (error) {
          results.errors.push(`Error en fechas para token ${row.Token}: ${error.message}`);
          continue;
        }

        // Buscar si el token ya existe
        const existingToken = await Token.findOne({ token: row.Token });

        if (existingToken) {
          // Actualizar token existente
          const updateFields = {
            expiresAt: expiresAt,
          };

          // Sólo actualizar campos que existen en el Excel
          if (row.Email) {
            updateFields.email = row.Email;
          }
          if (row.Nombre) {
            updateFields.name = row.Nombre;
          }
          if (row.Teléfono) {
            updateFields.phone = row.Teléfono;
          }
          if (redeemedAt) {
            updateFields.redeemedAt = redeemedAt;
          }
          if (row.Estado === 'Canjeado') {
            updateFields.isRedeemed = true;
          }
          if (row.ID_Máquina) {
            updateFields.machineId = row.ID_Máquina;
          }
          if (row.Dispositivo_Redención || row.IP_Redención) {
            updateFields.redemptionDetails = {
              ...(existingToken.redemptionDetails || {}),
              ...(row.IP_Redención ? { ip: row.IP_Redención } : {}),
              ...(row.Dispositivo_Redención ? { deviceInfo: row.Dispositivo_Redención } : {}),
              ...(redeemedAt ? { timestamp: redeemedAt } : {}),
            };
          }

          await Token.updateOne({ token: row.Token }, { $set: updateFields });

          results.updated++;
          console.log(`✅ Actualizado token: ${row.Token}`);
        } else {
          // Crear un nuevo token
          const tokenData = {
            token: row.Token,
            email: row.Email || 'no-email@example.com',
            name: row.Nombre || 'Usuario',
            phone: row.Teléfono || '0000000000',
            createdAt: createdAt,
            expiresAt: expiresAt,
            isRedeemed: row.Estado === 'Canjeado',
            redeemedAt: redeemedAt,
          };

          if (row.ID_Máquina) {
            tokenData.machineId = row.ID_Máquina;
          }

          if (row.Dispositivo_Redención || row.IP_Redención) {
            tokenData.redemptionDetails = {
              ip: row.IP_Redención || '',
              deviceInfo: row.Dispositivo_Redención || '',
              timestamp: redeemedAt || new Date(),
            };
          }

          const newToken = new Token(tokenData);
          await newToken.save();

          results.created++;
          console.log(`🆕 Creado nuevo token: ${row.Token}`);
        }
      } catch (error) {
        results.errors.push(`Error procesando token ${row.Token}: ${error.message}`);
      }
    }

    console.log('\n📊 Resultados de la importación:');
    console.log(`Total de registros: ${results.total}`);
    console.log(`Tokens creados: ${results.created}`);
    console.log(`Tokens actualizados: ${results.updated}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errores encontrados:');
      results.errors.forEach((error) => console.log(`- ${error}`));
    }

    await mongoose.connection.close();
    console.log('\n🔌 Conexión a MongoDB cerrada');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la importación:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

importTokens();
