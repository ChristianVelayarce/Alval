import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Product = {
  id: string;
  codigo: string;
  nombre: string;
  stock: number;
  unidad_medida: string;
  precio_unitario: number;
  created_at: string;
};

export type PedidoDetalle = {
  id?: string;
  pedido_id?: string;
  cantidad: number;
  codigo: string;
  nombre: string;
  precio_unitario: number;
  total: number;
};

export type Pedido = {
  id: string;
  numero_documento: string;
  dni_ruc: string | null;
  cliente: string;
  fecha: string;
  moneda: 'YUANES' | 'DOLARES' | 'SOLES';
  monto_total: number;
  cantidad_pagada: number;
  saldo: number;
  estado: 'PENDIENTE' | 'CREDITO' | 'FACTURADO' | 'ANULADO';
  cantidad_bultos: number;
  volumen_total: number;
  comision: number;
  fecha_termino_produccion: string | null;
  destino_entrega: string | null;
  created_at: string;
};

export type Pago = {
  id: string;
  pedido_id: string;
  monto: number;
  fecha: string;
  moneda: string;
  tipo_cambio: number;
  comprobante_tipo: string | null;
  comprobante_numero: string | null;
  created_at: string;
};

export function convertirMoneda(monto: number, tipoCambio: number): number {
  return monto * tipoCambio;
}

export const MONEDAS = ['YUANES', 'DOLARES', 'SOLES'] as const;
export const SIMBOLOS_MONEDA: Record<string, string> = {
  YUANES: '¥',
  DOLARES: '$',
  SOLES: 'S/',
};

export const ESTADOS = ['PENDIENTE', 'CREDITO', 'FACTURADO', 'ANULADO'] as const;

export function formatMoneda(monto: number, moneda: string): string {
  const simbolo = SIMBOLOS_MONEDA[moneda] || '';
  return `${simbolo} ${monto.toFixed(2)}`;
}
