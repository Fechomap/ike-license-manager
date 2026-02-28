// src/scripts/exportTokens.ts
import 'dotenv/config';

import * as fs from 'fs/promises';
import * as path from 'path';

import mongoose from 'mongoose';
import * as XLSX from 'xlsx';

import config from '../config/config';
import Token, { type IToken } from '../models/tokenModel';

interface ExcelExportRow {
  Token: string;
  Email: string;
  Nombre: string;
  Telefono: string;
  Fecha_Creacion: string;
  Fecha_Expiracion: string;
  Estado: string;
  Fecha_Canje: string;
  ID_Maquina: string;
  IP_Redencion: string;
  Dispositivo_Redencion: string;
  Timestamp_Redencion: string;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }

  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    return '';
  }

  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();

  // Determinar si es AM o PM
  const period = hours >= 12 ? 'p.m.' : 'a.m.';

  // Convertir a formato 12 horas
  let hour12 = hours % 12;
  hour12 = hour12 || 12; // 0 deberia ser 12 en formato 12 horas

  return (
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}, ` +
    `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${period}`
  );
}

async function exportTokens(): Promise<void> {
  try {
    const scriptsDir = path.join(__dirname, 'data');
    await fs.mkdir(scriptsDir, { recursive: true });

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.mongodbURI);
      console.log('Conectado a MongoDB');
    }

    const tokens: IToken[] = await Token.find({}).lean();
    console.log(`Encontrados ${tokens.length} tokens`);

    const excelData: ExcelExportRow[] = tokens.map((token) => ({
      Token: token.token || '',
      Email: token.email || '',
      Nombre: token.name || '',
      Telefono: token.phone || '',
      Fecha_Creacion: formatDate(token.createdAt),
      Fecha_Expiracion: formatDate(token.expiresAt),
      Estado: token.isRedeemed ? 'Canjeado' : 'No Canjeado',
      Fecha_Canje: formatDate(token.redeemedAt),
      ID_Maquina: token.machineId || '',
      IP_Redencion: token.redemptionDetails?.ip || '',
      Dispositivo_Redencion: token.redemptionDetails?.deviceInfo || '',
      Timestamp_Redencion: formatDate(token.redemptionDetails?.timestamp),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Ajustar anchos de columna
    worksheet['!cols'] = [
      { wch: 35 }, // Token
      { wch: 30 }, // Email
      { wch: 25 }, // Nombre
      { wch: 15 }, // Telefono
      { wch: 25 }, // Fecha_Creacion
      { wch: 25 }, // Fecha_Expiracion
      { wch: 12 }, // Estado
      { wch: 25 }, // Fecha_Canje
      { wch: 20 }, // ID_Maquina
      { wch: 15 }, // IP_Redencion
      { wch: 30 }, // Dispositivo_Redencion
      { wch: 25 }, // Timestamp_Redencion
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tokens');

    const filePath = path.join(scriptsDir, 'tokens_database.xlsx');
    const buffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    await fs.writeFile(filePath, buffer);

    console.log(`Base de datos exportada exitosamente a: ${filePath}`);

    await mongoose.connection.close();
    console.log('Conexion a MongoDB cerrada');

    process.exit(0);
  } catch (error) {
    console.error('Error en la exportacion:', error);
    process.exit(1);
  }
}

void exportTokens();
