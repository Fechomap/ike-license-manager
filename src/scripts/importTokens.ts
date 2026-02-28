// src/scripts/importTokens.ts
import 'dotenv/config';

import * as path from 'path';

import mongoose from 'mongoose';
import * as XLSX from 'xlsx';

import config from '../config/config';
import Token, { type IRedemptionDetails } from '../models/tokenModel';

interface ExcelRow {
  Token?: string;
  Email?: string;
  Nombre?: string;
  Telefono?: string;
  Fecha_Creacion?: string;
  Fecha_Expiracion?: string;
  Estado?: string;
  Fecha_Canje?: string;
  ID_Maquina?: string;
  IP_Redencion?: string;
  Dispositivo_Redencion?: string;
  Timestamp_Redencion?: string;
}

interface ImportResults {
  total: number;
  created: number;
  updated: number;
  errors: string[];
}

interface TokenUpdateFields {
  expiresAt?: Date;
  email?: string;
  name?: string;
  phone?: string;
  redeemedAt?: Date;
  isRedeemed?: boolean;
  machineId?: string;
  redemptionDetails?: IRedemptionDetails;
}

interface TokenCreateData {
  token: string;
  email: string;
  name: string;
  phone: string;
  createdAt: Date;
  expiresAt: Date;
  isRedeemed: boolean;
  redeemedAt?: Date;
  machineId?: string;
  redemptionDetails?: IRedemptionDetails;
}

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) {
    return null;
  }

  // Regex para el formato especifico
  const regex = /(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(a\.m\.|p\.m\.)/i;
  const match = dateStr.match(regex);

  if (!match) {
    throw new Error(`Formato de fecha no reconocido: ${dateStr}`);
  }

  const day = match[1] ?? '01';
  const month = match[2] ?? '01';
  const year = match[3] ?? '2000';
  const hours = match[4] ?? '0';
  const minutes = match[5] ?? '00';
  const seconds = match[6] ?? '00';
  const period = match[7] ?? 'a.m.';

  // Convertir a formato 24 horas
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === 'p.m.' && hour !== 12) {
    hour += 12;
  } else if (period.toLowerCase() === 'a.m.' && hour === 12) {
    hour = 0;
  }

  // Crear objeto Date
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    hour,
    parseInt(minutes, 10),
    parseInt(seconds, 10),
  );
}

async function importTokens(): Promise<void> {
  try {
    const scriptsDir = path.join(__dirname, 'data');
    const filePath = path.join(scriptsDir, 'tokens_database.xlsx');

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.mongodbURI);
      console.log('Conectado a MongoDB');
    }

    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('El archivo Excel no contiene hojas');
    }
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      throw new Error('No se pudo leer la primera hoja del Excel');
    }
    const data: ExcelRow[] = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    console.log(`Leyendo ${data.length} registros del archivo`);

    const results: ImportResults = {
      total: data.length,
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const row of data) {
      try {
        // Verificar que el token existe en el archivo Excel
        if (!row.Token) {
          results.errors.push('Encontrada fila sin token');
          continue;
        }

        // Parsear las fechas
        let createdAt: Date;
        let expiresAt: Date;
        let redeemedAt: Date | null = null;

        try {
          if (row.Fecha_Creacion) {
            const parsed = parseDate(row.Fecha_Creacion);
            createdAt = parsed ?? new Date();
          } else {
            // Si no hay fecha de creacion, usar la actual
            createdAt = new Date();
          }

          if (row.Fecha_Expiracion) {
            const parsed = parseDate(row.Fecha_Expiracion);
            expiresAt = parsed ?? new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000);
          } else {
            // Si no hay fecha de expiracion, crear una por defecto (90 dias)
            expiresAt = new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000);
          }

          if (row.Fecha_Canje) {
            redeemedAt = parseDate(row.Fecha_Canje);
          }

          // Verificar que las fechas son validas
          if (
            isNaN(createdAt.getTime()) ||
            isNaN(expiresAt.getTime()) ||
            (redeemedAt && isNaN(redeemedAt.getTime()))
          ) {
            throw new Error('Una o mas fechas no son validas');
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results.errors.push(`Error en fechas para token ${row.Token}: ${message}`);
          continue;
        }

        // Buscar si el token ya existe
        const existingToken = await Token.findOne({ token: row.Token });

        if (existingToken) {
          // Actualizar token existente
          const updateFields: TokenUpdateFields = {
            expiresAt: expiresAt,
          };

          // Solo actualizar campos que existen en el Excel
          if (row.Email) {
            updateFields.email = row.Email;
          }
          if (row.Nombre) {
            updateFields.name = row.Nombre;
          }
          if (row.Telefono) {
            updateFields.phone = row.Telefono;
          }
          if (redeemedAt) {
            updateFields.redeemedAt = redeemedAt;
          }
          if (row.Estado === 'Canjeado') {
            updateFields.isRedeemed = true;
          }
          if (row.ID_Maquina) {
            updateFields.machineId = row.ID_Maquina;
          }
          if (row.Dispositivo_Redencion || row.IP_Redencion) {
            updateFields.redemptionDetails = {
              ...(existingToken.redemptionDetails ?? {}),
              ...(row.IP_Redencion ? { ip: row.IP_Redencion } : {}),
              ...(row.Dispositivo_Redencion ? { deviceInfo: row.Dispositivo_Redencion } : {}),
              ...(redeemedAt ? { timestamp: redeemedAt } : {}),
            };
          }

          await Token.updateOne({ token: row.Token }, { $set: updateFields });

          results.updated++;
          console.log(`Actualizado token: ${row.Token}`);
        } else {
          // Crear un nuevo token
          const tokenData: TokenCreateData = {
            token: row.Token,
            email: row.Email || 'no-email@example.com',
            name: row.Nombre || 'Usuario',
            phone: row.Telefono || '0000000000',
            createdAt: createdAt,
            expiresAt: expiresAt,
            isRedeemed: row.Estado === 'Canjeado',
            redeemedAt: redeemedAt ?? undefined,
          };

          if (row.ID_Maquina) {
            tokenData.machineId = row.ID_Maquina;
          }

          if (row.Dispositivo_Redencion || row.IP_Redencion) {
            tokenData.redemptionDetails = {
              ip: row.IP_Redencion || '',
              deviceInfo: row.Dispositivo_Redencion || '',
              timestamp: redeemedAt ?? new Date(),
            };
          }

          const newToken = new Token(tokenData);
          await newToken.save();

          results.created++;
          console.log(`Creado nuevo token: ${row.Token}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.errors.push(`Error procesando token ${row.Token}: ${message}`);
      }
    }

    console.log('\nResultados de la importacion:');
    console.log(`Total de registros: ${results.total}`);
    console.log(`Tokens creados: ${results.created}`);
    console.log(`Tokens actualizados: ${results.updated}`);

    if (results.errors.length > 0) {
      console.log('\nErrores encontrados:');
      results.errors.forEach((err) => console.log(`- ${err}`));
    }

    await mongoose.connection.close();
    console.log('\nConexion a MongoDB cerrada');

    process.exit(0);
  } catch (error) {
    console.error('Error en la importacion:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

void importTokens();
