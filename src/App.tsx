import { useState, useCallback } from 'react';
import { supabase, type Pedido } from '@/lib/supabase';
import NuevoPedidoForm from '@/components/NuevoPedidoForm';
import PedidosList from '@/components/PedidosList';
import EditarPedidoForm from '@/components/EditarPedidoForm';

type View = 'list' | 'nuevo' | 'editar';

export default function App() {
  const [view, setView] = useState<View>('list');
  const [editarPedido, setEditarPedido] = useState<Pedido | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleNuevo = async (data: {
    cliente: string;
    dni_ruc: string;
    fecha: string;
    moneda: string;
    cantidad_bultos: number;
    volumen_total: number;
    comision: number;
    fecha_termino_produccion: string;
    destino_entrega: string;
    items: {
      product_id: string;
      codigo: string;
      nombre: string;
      cantidad: number;
      precio_unitario: number;
      total: number;
    }[];
  }) => {
    setSaving(true);
    const numeroDocumento = `PED-${Date.now().toString().slice(-8)}`;
    const montoTotal = data.items.reduce((acc, i) => acc + i.total, 0);

    const { data: pedidoData, error: pedError } = await supabase
      .from('pedidos')
      .insert({
        numero_documento: numeroDocumento,
        dni_ruc: data.dni_ruc || null,
        cliente: data.cliente,
        fecha: data.fecha,
        moneda: data.moneda,
        monto_total: montoTotal,
        cantidad_pagada: 0,
        saldo: montoTotal,
        estado: 'PENDIENTE',
        cantidad_bultos: data.cantidad_bultos,
        volumen_total: data.volumen_total,
        comision: data.comision,
        fecha_termino_produccion: data.fecha_termino_produccion || null,
        destino_entrega: data.destino_entrega || null,
      })
      .select()
      .single();

    if (pedError || !pedidoData) {
      alert('Error al guardar el pedido: ' + (pedError?.message || 'desconocido'));
      setSaving(false);
      return;
    }

    const detallesInsert = data.items.map((i) => ({
      pedido_id: (pedidoData as Pedido).id,
      cantidad: i.cantidad,
      codigo: i.codigo,
      nombre: i.nombre,
      precio_unitario: i.precio_unitario,
      total: i.total,
    }));

    const { error: detError } = await supabase
      .from('pedido_detalles')
      .insert(detallesInsert);

    if (detError) {
      alert('Error al guardar los detalles: ' + detError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    refresh();
    setView('list');
  };

  if (view === 'nuevo') {
    return (
      <NuevoPedidoForm
        onSave={handleNuevo}
        onCancel={() => setView('list')}
        saving={saving}
      />
    );
  }

  if (view === 'editar' && editarPedido) {
    return (
      <EditarPedidoForm
        pedido={editarPedido}
        onSave={() => {
          refresh();
          setEditarPedido(null);
          setView('list');
        }}
        onCancel={() => {
          setEditarPedido(null);
          setView('list');
        }}
      />
    );
  }

  return (
    <PedidosList
      onNuevo={() => setView('nuevo')}
      onEditar={(p: Pedido) => {
        setEditarPedido(p);
        setView('editar');
      }}
      refreshKey={refreshKey}
    />
  );
}
