/*
# Sistema de Gestión de Pedidos

## Descripción
Crea el esquema completo para un sistema de registro y gestión de pedidos.
Incluye catálogo de productos, pedidos con sus detalles (productos seleccionados),
y pagos asociados a cada pedido para la valorización.

## Tablas nuevas

### products (productos)
- id (uuid, pk)
- codigo (text, unique, not null) — código del producto
- nombre (text, not null) — nombre del producto
- stock (numeric, default 0) — stock disponible
- unidad_medida (text, not null) — unidad de medida (UND, KG, LT, etc.)
- precio_unitario (numeric, default 0) — precio unitario en la moneda base
- created_at (timestamptz)

### pedidos (pedidos/órdenes)
- id (uuid, pk)
- numero_documento (text, not null) — número de documento del pedido (generado automáticamente)
- dni_ruc (text) — DNI o RUC del cliente
- cliente (text, not null) — nombre del cliente
- fecha (date, not null) — fecha del pedido
- moneda (text, not null) — 'YUANES' | 'DOLARES' | 'SOLES'
- monto_total (numeric, not null, default 0) — suma total del pedido
- cantidad_pagada (numeric, not null, default 0) — total pagado
- saldo (numeric, not null, default 0) — monto_total - cantidad_pagada
- estado (text, not null, default 'PENDIENTE') — 'PENDIENTE' | 'CREDITO' | 'FACTURADO' | 'ANULADO'
- created_at (timestamptz)

### pedido_detalles (detalle de productos del pedido)
- id (uuid, pk)
- pedido_id (uuid, fk -> pedidos.id ON DELETE CASCADE)
- cantidad (numeric, not null)
- codigo (text, not null) — código del producto al momento del pedido
- nombre (text, not null) — nombre del producto al momento del pedido
- precio_unitario (numeric, not null)
- total (numeric, not null) — cantidad * precio_unitario

### pagos (pagos realizados sobre un pedido)
- id (uuid, pk)
- pedido_id (uuid, fk -> pedidos.id ON DELETE CASCADE)
- monto (numeric, not null)
- fecha (date, not null)
- moneda (text, not null)
- comprobante_tipo (text) — NULL si no tiene comprobante, 'BOLETA' | 'FACTURA' | 'VALE' si se convirtió
- comprobante_numero (text) — número de comprobante si se generó
- created_at (timestamptz)

## Seguridad
- App single-tenant sin login. RLS habilitado en todas las tablas.
- Políticas TO anon, authenticated con USING/WITH CHECK (true) porque los datos son compartidos.
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  stock numeric NOT NULL DEFAULT 0,
  unidad_medida text NOT NULL DEFAULT 'UND',
  precio_unitario numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_documento text NOT NULL,
  dni_ruc text,
  cliente text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  moneda text NOT NULL DEFAULT 'SOLES',
  monto_total numeric NOT NULL DEFAULT 0,
  cantidad_pagada numeric NOT NULL DEFAULT 0,
  saldo numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'PENDIENTE',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pedidos" ON pedidos;
CREATE POLICY "anon_select_pedidos" ON pedidos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pedidos" ON pedidos;
CREATE POLICY "anon_insert_pedidos" ON pedidos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pedidos" ON pedidos;
CREATE POLICY "anon_update_pedidos" ON pedidos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_pedidos" ON pedidos;
CREATE POLICY "anon_delete_pedidos" ON pedidos FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS pedido_detalles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  cantidad numeric NOT NULL,
  codigo text NOT NULL,
  nombre text NOT NULL,
  precio_unitario numeric NOT NULL,
  total numeric NOT NULL
);

ALTER TABLE pedido_detalles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pedido_detalles" ON pedido_detalles;
CREATE POLICY "anon_select_pedido_detalles" ON pedido_detalles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pedido_detalles" ON pedido_detalles;
CREATE POLICY "anon_insert_pedido_detalles" ON pedido_detalles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pedido_detalles" ON pedido_detalles;
CREATE POLICY "anon_update_pedido_detalles" ON pedido_detalles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_pedido_detalles" ON pedido_detalles;
CREATE POLICY "anon_delete_pedido_detalles" ON pedido_detalles FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  monto numeric NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  moneda text NOT NULL DEFAULT 'SOLES',
  comprobante_tipo text,
  comprobante_numero text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pagos" ON pagos;
CREATE POLICY "anon_select_pagos" ON pagos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pagos" ON pagos;
CREATE POLICY "anon_insert_pagos" ON pagos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pagos" ON pagos;
CREATE POLICY "anon_update_pagos" ON pagos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_pagos" ON pagos;
CREATE POLICY "anon_delete_pagos" ON pagos FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pedido_detalles_pedido_id ON pedido_detalles(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pedido_id ON pagos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha);
