// src/scripts/importTokens.ts
import 'dotenv/config';

import * as path from 'path';

import * as XLSX from 'xlsx';

import prisma from '../lib/prisma';
import { getFirstDayOfNextMonthAfterMonths } from '../services/tokenService';

interface ExcelRow {
  // Columnas comunes (sin variantes)
  Token?: string;
  Email?: string;
  Nombre?: string;
  Estado?: string;

  // Sin acento / underscore (exportTokens.ts)
  Telefono?: string;
  Fecha_Creacion?: string;
  Fecha_Expiracion?: string;
  Fecha_Canje?: string;
  ID_Maquina?: string;
  IP_Redencion?: string;
  Dispositivo_Redencion?: string;
  Timestamp_Redencion?: string;

  // Con acento (tokenService.ts exportToExcel)
  Teléfono?: string;
  'Fecha de Alta'?: string;
  'Fecha de Expiración'?: string;
  Fecha_Creación?: string;
  Fecha_Expiración?: string;
  Fecha_Redención?: string;
  ID_Máquina?: string;
  IP_Redención?: string;
  Dispositivo_Redención?: string;
  Timestamp_Redención?: string;

  // Permitir columnas adicionales desconocidas
  [key: string]: string | undefined;
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
  redemptionIp?: string;
  redemptionDeviceInfo?: string;
  redemptionTimestamp?: Date;
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
  redemptionIp?: string;
  redemptionDeviceInfo?: string;
  redemptionTimestamp?: Date;
}

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const trimmed = dateStr.trim();

  // Intentar ISO 8601 primero (mas robusto)
  const isoDate = new Date(trimmed);
  if (!isNaN(isoDate.getTime()) && trimmed.includes('-')) {
    return isoDate;
  }

  // Formato dd/mm/yyyy, hh:mm:ss a.m./p.m. (export script)
  const fullMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?$/i,
  );
  if (fullMatch) {
    const day = parseInt(fullMatch[1] ?? '0', 10);
    const month = parseInt(fullMatch[2] ?? '0', 10) - 1;
    const year = parseInt(fullMatch[3] ?? '0', 10);
    let hours = parseInt(fullMatch[4] ?? '0', 10);
    const minutes = parseInt(fullMatch[5] ?? '0', 10);
    const seconds = parseInt(fullMatch[6] ?? '0', 10);
    const meridiem = fullMatch[7];

    if (meridiem) {
      const isPM = /p\.?\s*m\.?/i.test(meridiem);
      if (isPM && hours < 12) {
        hours += 12;
      }
      if (!isPM && hours === 12) {
        hours = 0;
      }
    }

    return new Date(year, month, day, hours, minutes, seconds);
  }

  // Formato dd/mm/yyyy simple
  const simpleMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (simpleMatch) {
    const day = parseInt(simpleMatch[1] ?? '0', 10);
    const month = parseInt(simpleMatch[2] ?? '0', 10) - 1;
    const year = parseInt(simpleMatch[3] ?? '0', 10);
    return new Date(year, month, day);
  }

  return null;
}

async function importTokens(): Promise<void> {
  try {
    const scriptsDir = path.join(__dirname, 'data');
    const filePath = path.join(scriptsDir, 'tokens_database.xlsx');

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

    for (const [i, row] of data.entries()) {
      try {
        // Verificar que el token existe en el archivo Excel
        if (!row.Token) {
          results.errors.push('Encontrada fila sin token');
          continue;
        }

        // Resolver columnas con fallback: sin acento -> con acento -> variante alternativa
        const telefono = row.Telefono || row['Teléfono'];
        const fechaCreacionStr =
          row.Fecha_Creacion || row['Fecha_Creación'] || row['Fecha de Alta'];
        const fechaExpiracionStr =
          row.Fecha_Expiracion || row['Fecha_Expiración'] || row['Fecha de Expiración'];
        const fechaCanjeStr = row.Fecha_Canje || row['Fecha_Redención'];
        const idMaquina = row.ID_Maquina || row['ID_Máquina'];
        const ipRedencion = row.IP_Redencion || row['IP_Redención'];
        const dispositivoRedencion = row.Dispositivo_Redencion || row['Dispositivo_Redención'];

        // Parsear las fechas
        let createdAt: Date;
        let expiresAt: Date;
        let redeemedAt: Date | null = null;

        // createdAt: si viene pero no parsea, rechazar fila
        if (fechaCreacionStr) {
          const parsed = parseDate(fechaCreacionStr);
          if (parsed) {
            createdAt = parsed;
          } else {
            results.errors.push(
              `Fila ${i + 1}: fecha de creacion invalida "${fechaCreacionStr}", fila rechazada`,
            );
            continue;
          }
        } else {
          createdAt = new Date();
        }

        // expiresAt: si viene pero no parsea, rechazar fila
        if (fechaExpiracionStr) {
          const parsed = parseDate(fechaExpiracionStr);
          if (parsed) {
            expiresAt = parsed;
          } else {
            results.errors.push(
              `Fila ${i + 1}: fecha de expiracion invalida "${fechaExpiracionStr}", fila rechazada`,
            );
            continue;
          }
        } else {
          expiresAt = getFirstDayOfNextMonthAfterMonths(createdAt, 1);
        }

        // redeemedAt: si viene pero no parsea, solo warning (no rechazar)
        if (fechaCanjeStr) {
          const parsed = parseDate(fechaCanjeStr);
          if (parsed) {
            redeemedAt = parsed;
          } else {
            console.warn(
              `⚠️ Fila ${i + 1}: fecha de canje no reconocida "${fechaCanjeStr}", ignorando`,
            );
          }
        }

        // Buscar si el token ya existe
        const existingToken = await prisma.token.findUnique({ where: { token: row.Token } });

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
          if (telefono) {
            updateFields.phone = telefono;
          }
          if (redeemedAt) {
            updateFields.redeemedAt = redeemedAt;
          }
          if (row.Estado === 'Canjeado') {
            updateFields.isRedeemed = true;
          }
          if (idMaquina) {
            updateFields.machineId = idMaquina;
          }
          if (ipRedencion) {
            updateFields.redemptionIp = ipRedencion;
          }
          if (dispositivoRedencion) {
            updateFields.redemptionDeviceInfo = dispositivoRedencion;
          }
          if (redeemedAt) {
            updateFields.redemptionTimestamp = redeemedAt;
          }

          await prisma.token.update({
            where: { token: row.Token },
            data: updateFields,
          });

          results.updated++;
          console.log(`Actualizado token: ${row.Token}`);
        } else {
          // Crear un nuevo token
          const tokenData: TokenCreateData = {
            token: row.Token,
            email: row.Email || 'no-email@example.com',
            name: row.Nombre || 'Usuario',
            phone: telefono || '0000000000',
            createdAt: createdAt,
            expiresAt: expiresAt,
            isRedeemed: row.Estado === 'Canjeado',
            redeemedAt: redeemedAt ?? undefined,
          };

          if (idMaquina) {
            tokenData.machineId = idMaquina;
          }

          if (dispositivoRedencion || ipRedencion) {
            tokenData.redemptionIp = ipRedencion || '';
            tokenData.redemptionDeviceInfo = dispositivoRedencion || '';
            tokenData.redemptionTimestamp = redeemedAt ?? new Date();
          }

          await prisma.token.create({ data: tokenData });

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

    await prisma.$disconnect();
    console.log('\nConexion a PostgreSQL cerrada');

    process.exit(0);
  } catch (error) {
    console.error('Error en la importacion:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void importTokens();
