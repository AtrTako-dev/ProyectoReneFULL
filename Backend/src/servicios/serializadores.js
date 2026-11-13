function usuarioPublico(usuario) {
  if (!usuario) {
    return null;
  }
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol,
    activo: usuario.activo === true || Number(usuario.activo) === 1,
  };
}

function ventaPublica(venta) {
  if (!venta) {
    return null;
  }
  return {
    id: Number(venta.id),
    propietario_id: venta.propietario_id,
    fecha: venta.fecha,
    producto_id: venta.producto_id,
    producto: venta.producto,
    categoria: venta.categoria,
    precio_unitario_mxn: Number(venta.precio_unitario_mxn),
    cantidad: Number(venta.cantidad),
    total_mxn: Number(venta.total_mxn),
    importacion_id: venta.importacion_id === null || venta.importacion_id === undefined
      ? null
      : Number(venta.importacion_id),
    id_origen: venta.id_origen === undefined ? null : venta.id_origen,
    es_demostracion: Boolean(Number(venta.es_demostracion)),
  };
}

module.exports = { usuarioPublico, ventaPublica };
