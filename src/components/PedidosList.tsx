import { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  type Pedido,
  type PedidoDetalle,
  type Pago,
  formatMoneda,
  convertirMoneda,
  SIMBOLOS_MONEDA,
  ESTADOS,
} from '@/lib/supabase';
import {
  Plus,
  Pencil,
  Ban,
  Printer,
  CreditCard,
  Receipt,
  Eye,
  FileText,
  X,
  Trash2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

type Props = {
  onNuevo: () => void;
  onEditar: (pedido: Pedido) => void;
  refreshKey: number;
};

export default function PedidosList({ onNuevo, onEditar, refreshKey }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [valorizarPedido, setValorizarPedido] = useState<Pedido | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [detalles, setDetalles] = useState<PedidoDetalle[]>([]);
  const [showPagoModal, setShowPagoModal] = useState<Pedido | null>(null);
  const [printMode, setPrintMode] = useState<Pedido | null>(null);
  const [printType, setPrintType] = useState<'pedido' | 'valorizacion' | null>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoFecha, setPagoFecha] = useState(new Date().toISOString().split('T')[0]);
  const [pagoMoneda, setPagoMoneda] = useState('SOLES');
  const [pagoTipoCambio, setPagoTipoCambio] = useState('1.00');
  const [savingPago, setSavingPago] = useState(false);

  const loadPedidos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setPedidos(data as Pedido[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPedidos();
  }, [refreshKey, loadPedidos]);

  const anularPedido = async (p: Pedido) => {
    if (!confirm(`¿Anular el pedido ${p.numero_documento}?`)) return;
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: 'ANULADO' })
      .eq('id', p.id);
    if (error) {
      alert('Error al anular: ' + error.message);
      return;
    }
    loadPedidos();
  };

  const registrarPago = async () => {
    if (!showPagoModal) return;
    const monto = parseFloat(pagoMonto);
    if (isNaN(monto) || monto <= 0) {
      alert('Ingrese un monto válido');
      return;
    }
    const tipoCambio = parseFloat(pagoTipoCambio);
    if (isNaN(tipoCambio) || tipoCambio <= 0) {
      alert('Ingrese un tipo de cambio válido');
      return;
    }
    setSavingPago(true);
    const { error: pagoError } = await supabase.from('pagos').insert({
      pedido_id: showPagoModal.id,
      monto,
      fecha: pagoFecha,
      moneda: pagoMoneda,
      tipo_cambio: tipoCambio,
    });
    if (pagoError) {
      alert('Error: ' + pagoError.message);
      setSavingPago(false);
      return;
    }

    const montoConvertido = convertirMoneda(monto, tipoCambio);
    const nuevaCantidadPagada = showPagoModal.cantidad_pagada + montoConvertido;
    const nuevoSaldo = showPagoModal.monto_total - nuevaCantidadPagada;
    let nuevoEstado = showPagoModal.estado;
    if (nuevoSaldo <= 0) {
      nuevoEstado = 'FACTURADO';
    } else if (nuevaCantidadPagada > 0) {
      nuevoEstado = 'CREDITO';
    }

    await supabase
      .from('pedidos')
      .update({
        cantidad_pagada: nuevaCantidadPagada,
        saldo: Math.max(0, nuevoSaldo),
        estado: nuevoEstado,
      })
      .eq('id', showPagoModal.id);

    setSavingPago(false);
    setShowPagoModal(null);
    setPagoMonto('');
    setPagoFecha(new Date().toISOString().split('T')[0]);
    setPagoMoneda('SOLES');
    setPagoTipoCambio('1.00');
    loadPedidos();
  };

  const abrirValorizar = async (p: Pedido) => {
    setValorizarPedido(p);
    const [pagosRes, detallesRes] = await Promise.all([
      supabase.from('pagos').select('*').eq('pedido_id', p.id).order('created_at'),
      supabase.from('pedido_detalles').select('*').eq('pedido_id', p.id),
    ]);
    if (pagosRes.data) setPagos(pagosRes.data as Pago[]);
    if (detallesRes.data) setDetalles(detallesRes.data as PedidoDetalle[]);
  };

  const convertirComprobante = async (pago: Pago, tipo: string) => {
    const numero = `C${Date.now().toString().slice(-8)}`;
    const { error } = await supabase
      .from('pagos')
      .update({ comprobante_tipo: tipo, comprobante_numero: numero })
      .eq('id', pago.id);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    if (valorizarPedido) {
      abrirValorizar(valorizarPedido);
      loadPedidos();
    }
  };

  const imprimir = (p: Pedido, tipo: 'pedido' | 'valorizacion') => {
    setPrintMode(p);
    setPrintType(tipo);
  };

  const estadoColor = (estado: string): string => {
    switch (estado) {
      case 'PENDIENTE':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'CREDITO':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'FACTURADO':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'ANULADO':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Print view
  if (printMode && printType) {
    return (
      <PrintView
        pedido={printMode}
        tipo={printType}
        detalles={detalles}
        pagos={pagos}
        onClose={() => {
          setPrintMode(null);
          setPrintType(null);
        }}
        onLoadData={async () => {
          const [pagosRes, detallesRes] = await Promise.all([
            supabase.from('pagos').select('*').eq('pedido_id', printMode.id).order('created_at'),
            supabase.from('pedido_detalles').select('*').eq('pedido_id', printMode.id),
          ]);
          if (pagosRes.data) setPagos(pagosRes.data as Pago[]);
          if (detallesRes.data) setDetalles(detallesRes.data as PedidoDetalle[]);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Listado de Pedidos</h1>
              <p className="text-sm text-slate-400">{pedidos.length} pedidos registrados</p>
            </div>
          </div>
          <button
            onClick={onNuevo}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo Pedido
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">N° Documento</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">DNI/RUC</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Fecha</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Monto</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Moneda</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Pagado</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Saldo</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Estado</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">
                      Cargando pedidos...
                    </td>
                  </tr>
                )}
                {!loading && pedidos.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">
                      No hay pedidos registrados. Haga clic en "Nuevo Pedido" para crear uno.
                    </td>
                  </tr>
                )}
                {pedidos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition"
                  >
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {p.numero_documento}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.dni_ruc || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.cliente}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(p.fecha).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {formatMoneda(p.monto_total, p.moneda)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{p.moneda}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">
                      {formatMoneda(p.cantidad_pagada, p.moneda)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-500 font-medium">
                      {formatMoneda(p.saldo, p.moneda)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${estadoColor(
                          p.estado
                        )}`}
                      >
                        {p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <ActionBtn
                          icon={<Pencil className="w-3.5 h-3.5" />}
                          title="Editar"
                          onClick={() => onEditar(p)}
                          disabled={p.estado === 'ANULADO'}
                          color="blue"
                        />
                        <ActionBtn
                          icon={<Ban className="w-3.5 h-3.5" />}
                          title="Anular"
                          onClick={() => anularPedido(p)}
                          disabled={p.estado === 'ANULADO'}
                          color="red"
                        />
                        <PrintMenu
                          onPedido={() => imprimir(p, 'pedido')}
                          onValorizacion={() => imprimir(p, 'valorizacion')}
                          disabled={p.estado === 'ANULADO'}
                        />
                        <ActionBtn
                          icon={<CreditCard className="w-3.5 h-3.5" />}
                          title="Pagar"
                          onClick={() => {
                            setShowPagoModal(p);
                            setPagoMonto(p.saldo.toString());
                            setPagoFecha(new Date().toISOString().split('T')[0]);
                            setPagoMoneda(p.moneda);
                            setPagoTipoCambio('1.00');
                          }}
                          disabled={p.estado === 'ANULADO' || p.saldo <= 0}
                          color="green"
                        />
                        <ActionBtn
                          icon={<Eye className="w-3.5 h-3.5" />}
                          title="Valorizar"
                          onClick={() => abrirValorizar(p)}
                          color="purple"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Pago */}
      {showPagoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Registrar Pago</h3>
              <button
                onClick={() => setShowPagoModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                <p className="text-sm text-slate-500">
                  Pedido: <span className="font-medium text-slate-700">{showPagoModal.numero_documento}</span>
                </p>
                <p className="text-sm text-slate-500">
                  Cliente: <span className="font-medium text-slate-700">{showPagoModal.cliente}</span>
                </p>
                <p className="text-sm text-slate-500">
                  Saldo: <span className="font-medium text-red-500">{formatMoneda(showPagoModal.saldo, showPagoModal.moneda)}</span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Fecha de abono
                </label>
                <input
                  type="date"
                  value={pagoFecha}
                  onChange={(e) => setPagoFecha(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Monto a pagar
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pagoMonto}
                  onChange={(e) => setPagoMonto(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Moneda del pago
                  </label>
                  <select
                    value={pagoMoneda}
                    onChange={(e) => setPagoMoneda(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
                  >
                    <option value="SOLES">Soles (S/)</option>
                    <option value="DOLARES">Dólares ($)</option>
                    <option value="YUANES">Yuanes (¥)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Tipo de cambio
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={pagoTipoCambio}
                    onChange={(e) => setPagoTipoCambio(e.target.value)}
                    disabled={pagoMoneda === showPagoModal.moneda}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-slate-100 disabled:text-slate-400"
                    placeholder="1.00"
                  />
                </div>
              </div>
              {pagoMoneda !== showPagoModal.moneda && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  {formatMoneda(parseFloat(pagoMonto) || 0, pagoMoneda)} equivale a{' '}
                  <span className="font-bold">
                    {formatMoneda(
                      convertirMoneda(parseFloat(pagoMonto) || 0, parseFloat(pagoTipoCambio) || 1),
                      showPagoModal.moneda
                    )}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPagoModal(null)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={registrarPago}
                disabled={savingPago}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {savingPago ? 'Guardando...' : 'Pagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Valorización */}
      {valorizarPedido && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Valorización — {valorizarPedido.numero_documento}
                </h3>
                <p className="text-sm text-slate-400">
                  {valorizarPedido.cliente} · {formatMoneda(valorizarPedido.monto_total, valorizarPedido.moneda)}
                </p>
              </div>
              <button
                onClick={() => setValorizarPedido(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <StatCard
                label="Total"
                value={formatMoneda(valorizarPedido.monto_total, valorizarPedido.moneda)}
                color="slate"
              />
              <StatCard
                label="Pagado"
                value={formatMoneda(valorizarPedido.cantidad_pagada, valorizarPedido.moneda)}
                color="green"
              />
              <StatCard
                label="Saldo"
                value={formatMoneda(valorizarPedido.saldo, valorizarPedido.moneda)}
                color="red"
              />
            </div>

            <h4 className="font-semibold text-slate-700 mb-3">Pagos Realizados</h4>
            {pagos.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg mb-4">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                No hay pagos registrados
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {pagos.map((pago) => (
                  <div
                    key={pago.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">
                          {formatMoneda(pago.monto, pago.moneda)}
                          {pago.moneda !== valorizarPedido.moneda && (
                            <span className="ml-2 text-xs text-slate-400 font-normal">
                              → {formatMoneda(convertirMoneda(pago.monto, pago.tipo_cambio), valorizarPedido.moneda)}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(pago.fecha).toLocaleDateString('es-PE')}
                          {pago.moneda !== valorizarPedido.moneda && (
                            <span className="ml-1">· T.C. {pago.tipo_cambio.toFixed(4)}</span>
                          )}
                          {pago.comprobante_tipo && (
                            <span className="ml-2 text-blue-600 font-medium">
                              · {pago.comprobante_tipo} {pago.comprobante_numero}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {pago.comprobante_tipo ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium px-3 py-1 bg-green-50 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" /> Comprobante emitido
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => convertirComprobante(pago, 'BOLETA')}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          Boleta
                        </button>
                        <button
                          onClick={() => convertirComprobante(pago, 'FACTURA')}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition"
                        >
                          Factura
                        </button>
                        <button
                          onClick={() => convertirComprobante(pago, 'VALE')}
                          className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                        >
                          Vale
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowPagoModal(valorizarPedido);
                  setPagoMonto(valorizarPedido.saldo.toString());
                  setPagoFecha(new Date().toISOString().split('T')[0]);
                  setPagoMoneda(valorizarPedido.moneda);
                  setPagoTipoCambio('1.00');
                  setValorizarPedido(null);
                }}
                disabled={valorizarPedido.saldo <= 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" /> Registrar Pago
              </button>
              <button
                onClick={() => {
                  imprimir(valorizarPedido, 'valorizacion');
                  setValorizarPedido(null);
                }}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition"
              >
                <Printer className="w-4 h-4" /> Imprimir Valorización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  icon,
  title,
  onClick,
  disabled,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'hover:bg-blue-100 hover:text-blue-600',
    red: 'hover:bg-red-100 hover:text-red-600',
    green: 'hover:bg-green-100 hover:text-green-600',
    purple: 'hover:bg-purple-100 hover:text-purple-600',
  };
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-md text-slate-500 transition disabled:opacity-30 disabled:cursor-not-allowed ${colors[color]}`}
    >
      {icon}
    </button>
  );
}

function PrintMenu({
  onPedido,
  onValorizacion,
  disabled,
}: {
  onPedido: () => void;
  onValorizacion: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        title="Imprimir"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Printer className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px]">
            <button
              onClick={() => {
                onPedido();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" /> Pedido
            </button>
            <button
              onClick={() => {
                onValorizacion();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition flex items-center gap-2"
            >
              <Receipt className="w-3.5 h-3.5" /> Valorización
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`rounded-lg p-3 border ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function PrintView({
  pedido,
  tipo,
  detalles,
  pagos,
  onClose,
  onLoadData,
}: {
  pedido: Pedido;
  tipo: 'pedido' | 'valorizacion';
  detalles: PedidoDetalle[];
  pagos: Pago[];
  onClose: () => void;
  onLoadData: () => Promise<void>;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      await onLoadData();
      setLoaded(true);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">
            {tipo === 'pedido' ? 'Pedido' : 'Valorización'} — {pedido.numero_documento}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
            >
              <X className="w-4 h-4" /> Cerrar
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 print:shadow-none print:border-0">
          <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {tipo === 'pedido' ? 'ORDEN DE PEDIDO' : 'VALORIZACIÓN'}
              </h1>
              <p className="text-sm text-slate-400">N° {pedido.numero_documento}</p>
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>Fecha: {new Date(pedido.fecha).toLocaleDateString('es-PE')}</p>
              <p>Cliente: {pedido.cliente}</p>
              {pedido.dni_ruc && <p>DNI/RUC: {pedido.dni_ruc}</p>}
              {pedido.destino_entrega && <p>Destino: {pedido.destino_entrega}</p>}
              {pedido.fecha_termino_produccion && (
                <p>Término Producción: {new Date(pedido.fecha_termino_produccion).toLocaleDateString('es-PE')}</p>
              )}
            </div>
          </div>

          {tipo === 'pedido' && (pedido.cantidad_bultos > 0 || pedido.volumen_total > 0 || pedido.comision > 0) && (
            <div className="grid grid-cols-3 gap-4 mb-4 bg-slate-50 rounded-lg p-3 text-sm">
              {pedido.cantidad_bultos > 0 && (
                <div>
                  <span className="text-slate-400">Bultos: </span>
                  <span className="font-medium text-slate-700">{pedido.cantidad_bultos}</span>
                </div>
              )}
              {pedido.volumen_total > 0 && (
                <div>
                  <span className="text-slate-400">Volumen: </span>
                  <span className="font-medium text-slate-700">{pedido.volumen_total.toFixed(2)} m³</span>
                </div>
              )}
              {pedido.comision > 0 && (
                <div>
                  <span className="text-slate-400">Comisión: </span>
                  <span className="font-medium text-slate-700">{formatMoneda(pedido.comision, pedido.moneda)}</span>
                </div>
              )}
            </div>
          )}

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-slate-200">
                {tipo === 'pedido' ? (
                  <>
                    <th className="text-left py-2 font-semibold text-slate-600">Código</th>
                    <th className="text-left py-2 font-semibold text-slate-600">Descripción</th>
                    <th className="text-right py-2 font-semibold text-slate-600">Cantidad</th>
                    <th className="text-right py-2 font-semibold text-slate-600">P. Unit.</th>
                    <th className="text-right py-2 font-semibold text-slate-600">Total</th>
                  </>
                ) : (
                  <>
                    <th className="text-left py-2 font-semibold text-slate-600">Fecha</th>
                    <th className="text-right py-2 font-semibold text-slate-600">Monto</th>
                    <th className="text-center py-2 font-semibold text-slate-600">T.C.</th>
                    <th className="text-right py-2 font-semibold text-slate-600">Convertido</th>
                    <th className="text-left py-2 font-semibold text-slate-600">Comprobante</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {!loaded && (
                <tr>
                  <td colSpan={tipo === 'pedido' ? 5 : 5} className="text-center py-4 text-slate-400">
                    Cargando...
                  </td>
                </tr>
              )}
              {tipo === 'pedido' &&
                loaded &&
                detalles.map((d, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 text-slate-600">{d.codigo}</td>
                    <td className="py-2 text-slate-600">{d.nombre}</td>
                    <td className="py-2 text-right text-slate-600">{d.cantidad}</td>
                    <td className="py-2 text-right text-slate-600">{d.precio_unitario.toFixed(2)}</td>
                    <td className="py-2 text-right font-medium text-slate-700">{d.total.toFixed(2)}</td>
                  </tr>
                ))}
              {tipo === 'valorizacion' &&
                loaded &&
                pagos.map((p, i) => {
                  const convertido = convertirMoneda(p.monto, p.tipo_cambio);
                  const mismomoneda = p.moneda === pedido.moneda;
                  return (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 text-slate-600">
                        {new Date(p.fecha).toLocaleDateString('es-PE')}
                      </td>
                      <td className="py-2 text-right font-medium text-slate-700">
                        {formatMoneda(p.monto, p.moneda)}
                      </td>
                      <td className="py-2 text-center text-slate-500 text-xs">
                        {mismomoneda ? '—' : p.tipo_cambio.toFixed(4)}
                      </td>
                      <td className="py-2 text-right text-slate-600">
                        {mismomoneda
                          ? formatMoneda(p.monto, pedido.moneda)
                          : formatMoneda(convertido, pedido.moneda)}
                      </td>
                      <td className="py-2 text-slate-600">
                        {p.comprobante_tipo
                          ? `${p.comprobante_tipo} ${p.comprobante_numero}`
                          : 'Sin comprobante'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          <div className="border-t border-slate-200 pt-4 space-y-1">
            {tipo === 'pedido' ? (
              <>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-blue-600">
                    {formatMoneda(pedido.monto_total, pedido.moneda)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between font-bold text-base border-b border-slate-100 pb-2 mb-2">
                  <span>Monto Total del Pedido:</span>
                  <span className="text-slate-800">
                    {formatMoneda(pedido.monto_total, pedido.moneda)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Total Pagado (en {pedido.moneda}):</span>
                  <span className="font-medium text-green-600">
                    {formatMoneda(pedido.cantidad_pagada, pedido.moneda)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Saldo:</span>
                  <span className="font-medium text-red-500">
                    {formatMoneda(pedido.saldo, pedido.moneda)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
