import { useState, useEffect } from 'react';
import { supabase, type Product, type Pedido, type PedidoDetalle } from '@/lib/supabase';
import { Plus, Trash2, Search, Save, X, ShoppingCart } from 'lucide-react';

type SelectedItem = {
  product_id?: string;
  id?: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  unidad_medida?: string;
  stock?: number;
};

type Props = {
  pedido: Pedido;
  onSave: () => void;
  onCancel: () => void;
};

export default function EditarPedidoForm({ pedido, onSave, onCancel }: Props) {
  const [cliente, setCliente] = useState(pedido.cliente);
  const [dniRuc, setDniRuc] = useState(pedido.dni_ruc || '');
  const [fecha, setFecha] = useState(pedido.fecha);
  const [moneda, setMoneda] = useState(pedido.moneda);
  const [cantidadBultos, setCantidadBultos] = useState(String(pedido.cantidad_bultos || 0));
  const [volumenTotal, setVolumenTotal] = useState(String(pedido.volumen_total || 0));
  const [comision, setComision] = useState(String(pedido.comision || 0));
  const [fechaTermino, setFechaTermino] = useState(pedido.fecha_termino_produccion || '');
  const [destinoEntrega, setDestinoEntrega] = useState(pedido.destino_entrega || '');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [prodRes, detRes] = await Promise.all([
        supabase.from('products').select('*').order('nombre'),
        supabase.from('pedido_detalles').select('*').eq('pedido_id', pedido.id),
      ]);
      if (prodRes.data) setProducts(prodRes.data as Product[]);
      if (detRes.data) {
        setSelected(
          (detRes.data as PedidoDetalle[]).map((d) => ({
            id: d.id,
            codigo: d.codigo,
            nombre: d.nombre,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            total: d.total,
          }))
        );
      }
      setLoading(false);
    })();
  }, [pedido.id]);

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    return p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q);
  });

  const addProduct = (p: Product) => {
    const existing = selected.find((s) => s.codigo === p.codigo);
    if (existing) {
      updateCantidad(existing.codigo, existing.cantidad + 1);
      return;
    }
    setSelected([
      ...selected,
      {
        product_id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        cantidad: 1,
        precio_unitario: p.precio_unitario,
        total: p.precio_unitario,
        unidad_medida: p.unidad_medida,
        stock: p.stock,
      },
    ]);
  };

  const updateCantidad = (codigo: string, cantidad: number) => {
    setSelected((prev) =>
      prev.map((s) => {
        if (s.codigo !== codigo) return s;
        const cant = Math.max(1, cantidad);
        return { ...s, cantidad: cant, total: cant * s.precio_unitario };
      })
    );
  };

  const updatePrecio = (codigo: string, precio: number) => {
    setSelected((prev) =>
      prev.map((s) => {
        if (s.codigo !== codigo) return s;
        const p = Math.max(0, precio);
        return { ...s, precio_unitario: p, total: s.cantidad * p };
      })
    );
  };

  const removeItem = (codigo: string) => {
    setSelected(selected.filter((s) => s.codigo !== codigo));
  };

  const sumatoria = selected.reduce((acc, s) => acc + s.total, 0);

  const handleSubmit = async () => {
    if (!cliente.trim()) {
      alert('Ingrese el nombre del cliente');
      return;
    }
    if (selected.length === 0) {
      alert('Seleccione al menos un producto');
      return;
    }
    setSaving(true);

    const nuevoSaldo = sumatoria - pedido.cantidad_pagada;

    const { error: pedError } = await supabase
      .from('pedidos')
      .update({
        cliente,
        dni_ruc: dniRuc,
        fecha,
        moneda,
        monto_total: sumatoria,
        saldo: Math.max(0, nuevoSaldo),
        cantidad_bultos: parseInt(cantidadBultos) || 0,
        volumen_total: parseFloat(volumenTotal) || 0,
        comision: parseFloat(comision) || 0,
        fecha_termino_produccion: fechaTermino || null,
        destino_entrega: destinoEntrega || null,
      })
      .eq('id', pedido.id);
    if (pedError) {
      alert('Error: ' + pedError.message);
      setSaving(false);
      return;
    }

    await supabase.from('pedido_detalles').delete().eq('pedido_id', pedido.id);

    const detallesInsert = selected.map((s) => ({
      pedido_id: pedido.id,
      cantidad: s.cantidad,
      codigo: s.codigo,
      nombre: s.nombre,
      precio_unitario: s.precio_unitario,
      total: s.total,
    }));

    const { error: detError } = await supabase
      .from('pedido_detalles')
      .insert(detallesInsert);
    if (detError) {
      alert('Error al guardar detalles: ' + detError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSave();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              Editar Pedido {pedido.numero_documento}
            </h1>
          </div>
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" /> Cancelar
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-700 border-b border-slate-100 pb-3">
              Datos del Pedido
            </h2>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Cliente</label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">DNI / RUC</label>
              <input
                type="text"
                value={dniRuc}
                onChange={(e) => setDniRuc(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Moneda</label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as 'YUANES' | 'DOLARES' | 'SOLES')}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
              >
                <option value="SOLES">Soles (S/)</option>
                <option value="DOLARES">Dólares ($)</option>
                <option value="YUANES">Yuanes (¥)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Bultos</label>
                <input
                  type="number"
                  min={0}
                  value={cantidadBultos}
                  onChange={(e) => setCantidadBultos(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Volumen (m³)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={volumenTotal}
                  onChange={(e) => setVolumenTotal(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Comisión</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={comision}
                onChange={(e) => setComision(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Fecha Término Producción</label>
              <input
                type="date"
                value={fechaTermino}
                onChange={(e) => setFechaTermino(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Destino de Entrega</label>
              <input
                type="text"
                value={destinoEntrega}
                onChange={(e) => setDestinoEntrega(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Dirección o ciudad de entrega"
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              Pagado: {pedido.cantidad_pagada.toFixed(2)} — El saldo se recalcula automáticamente.
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-4">
              Productos Disponibles
            </h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Buscar por código o nombre..."
              />
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {loading && (
                <p className="text-center text-slate-400 py-8">Cargando productos...</p>
              )}
              {!loading && filteredProducts.length === 0 && (
                <p className="text-center text-slate-400 py-8">No se encontraron productos</p>
              )}
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition group cursor-pointer"
                  onClick={() => addProduct(p)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 text-sm">
                      {p.codigo} — {p.nombre}
                    </p>
                    <p className="text-xs text-slate-400">
                      Stock: {p.stock} {p.unidad_medida} · Precio: S/ {p.precio_unitario.toFixed(2)}
                    </p>
                  </div>
                  <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition flex-shrink-0 ml-2" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-4">
              Productos Seleccionados
            </h2>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px]">
              {selected.length === 0 && (
                <p className="text-center text-slate-400 py-8">
                  No hay productos seleccionados
                </p>
              )}
              {selected.map((s) => (
                <div
                  key={s.codigo}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 text-sm">
                        {s.codigo} — {s.nombre}
                      </p>
                      {s.stock !== undefined && (
                        <p className="text-xs text-slate-400">
                          Stock: {s.stock} {s.unidad_medida}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(s.codigo)}
                      className="text-slate-400 hover:text-red-500 transition flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Cant.</label>
                      <input
                        type="number"
                        min={1}
                        value={s.cantidad}
                        onChange={(e) =>
                          updateCantidad(s.codigo, parseFloat(e.target.value) || 1)
                        }
                        className="w-full px-2 py-1 text-sm rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">P. Unit.</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={s.precio_unitario}
                        onChange={(e) =>
                          updatePrecio(s.codigo, parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1 text-sm rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Total</label>
                      <div className="px-2 py-1 text-sm font-semibold text-slate-700 rounded bg-slate-100 text-right">
                        {s.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 mt-4 pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-slate-700">Total:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {moneda === 'SOLES' ? 'S/' : moneda === 'DOLARES' ? '$' : '¥'}{' '}
                  {sumatoria.toFixed(2)}
                </span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
