function ventaPublica(venta) {
  if (!venta) return null;
  return {
    id_venta: Number(venta.id_venta),
    id_origen: venta.id_origen === undefined ? null : venta.id_origen,
    usuario_id: Number(venta.usuario_id),
    fecha: venta.fecha,
    producto_id: venta.producto_id,
    producto: venta.producto,
    categoria: venta.categoria,
    precio_unitario_mxn: Number(venta.precio_unitario_mxn),
    cantidad: Number(venta.cantidad),
    total_mxn: Number(venta.total_mxn),
  };
}

module.exports = { ventaPublica };
