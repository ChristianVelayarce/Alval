/*
# Add logistics fields to pedidos table

## Descripción
Agrega campos logísticos al pedido: bultos, volumen, comisión, fecha de término
de producción y destino de entrega.

## Cambios
- `cantidad_bultos` (integer, default 0) — número de bultos de la carga
- `volumen_total` (numeric, default 0) — volumen total de la carga (m³)
- `comision` (numeric, default 0) — comisión del pedido
- `fecha_termino_produccion` (date, nullable) — fecha de término de producción
- `destino_entrega` (text, nullable) — destino de entrega

## Seguridad
- Sin cambios en RLS. Las políticas existentes cubren las nuevas columnas.
*/

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cantidad_bultos integer NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS volumen_total numeric NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comision numeric NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS fecha_termino_produccion date;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS destino_entrega text;