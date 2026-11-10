function usuarioPublico(usuario) {
  if (!usuario) {
    return null;
  }
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
  };
}

function ventaPublica(venta) {
  return {
    id_venta: Number(venta.id_venta),
    usuario_id: Number(venta.usuario_id),
    fecha: venta.fecha,
    producto_id: Number(venta.producto_id),
    producto: venta.producto,
    categoria: venta.categoria,
    precio_unitario_mxn: Number(venta.precio_unitario_mxn),
    cantidad: Number(venta.cantidad),
    total_mxn: Number(venta.total_mxn),
  };
}

module.exports = { usuarioPublico, ventaPublica };
