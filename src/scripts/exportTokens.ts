// src/scripts/exportTokens.ts
import 'dotenv/config';

import * as fs from 'fs/promises';
import * as path from 'path';

import * as XLSX from 'xlsx';

import prisma from '../lib/prisma';

interface ExcelExportRow {
  Token: string;
  Email: string;
  Nombre: string;
  Telefono: string;
  Fecha_Creacion: string;
  Fecha_Expiracion: string;
  Estado: string;
  Estado_Licencia: string;
  Fecha_Canje: string;
  Dispositivos: number;
  IDs_Maquina: string;
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

    const tokens = await prisma.token.findMany({ include: { machines: true } });
    console.log(`Encontrados ${tokens.length} tokens`);

    const excelData: ExcelExportRow[] = tokens.map((token) => ({
      Token: token.token || '',
      Email: token.email || '',
      Nombre: token.name || '',
      Telefono: token.phone || '',
      Fecha_Creacion: formatDate(token.createdAt),
      Fecha_Expiracion: formatDate(token.expiresAt),
      Estado: token.isRedeemed ? 'Canjeado' : 'No Canjeado',
      Estado_Licencia: token.status,
      Fecha_Canje: formatDate(token.redeemedAt),
      Dispositivos: token.machines.length,
      IDs_Maquina: token.machines.map((m) => m.machineId).join(', '),
      IP_Redencion: token.redemptionIp || '',
      Dispositivo_Redencion: token.redemptionDeviceInfo || '',
      Timestamp_Redencion: formatDate(token.redemptionTimestamp),
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
      { wch: 15 }, // Estado_Licencia
      { wch: 25 }, // Fecha_Canje
      { wch: 14 }, // Dispositivos
      { wch: 50 }, // IDs_Maquina
      { wch: 15 }, // IP_Redencion
      { wch: 30 }, // Dispositivo_Redencion
      { wch: 25 }, // Timestamp_Redencion
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tokens');

    const filePath = path.join(scriptsDir, 'tokens_database.xlsx');
    const buffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    await fs.writeFile(filePath, buffer);

    console.log(`Base de datos exportada exitosamente a: ${filePath}`);

    await prisma.$disconnect();
    console.log('Conexion a PostgreSQL cerrada');

    process.exit(0);
  } catch (error) {
    console.error('Error en la exportacion:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void exportTokens();
