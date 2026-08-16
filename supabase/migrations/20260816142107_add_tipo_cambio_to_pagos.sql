/*
# Add tipo_cambio to pagos table

## Descripción
Agrega la columna `tipo_cambio` a la tabla `pagos` para registrar el tipo de cambio
de la moneda del pago respecto a la moneda del pedido. Esto permite que los pagos
se realicen en una moneda distinta a la del pedido y calcular la conversión.

## Cambios
- Nueva columna `tipo_cambio` (numeric, default 1.0) en la tabla `pagos`.
  Representa cuántas unidades de la moneda del pedido equivale 1 unidad de la moneda del pago.
  Ej: si el pedido está en SOLES y se paga en DÓLARES con tipo_cambio 3.5,
  entonces $100 = S/350.

## Seguridad
- Sin cambios en RLS. Las políticas existentes cubren la nueva columna automáticamente.
*/

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS tipo_cambio numeric NOT NULL DEFAULT 1.0;