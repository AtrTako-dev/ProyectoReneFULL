-- Esquema MySQL 8 del backend Proyecto ReneFULL.
-- Fuente de verdad: Backend/docs/API_CONTRACT.md, secciones 1 y 8.
--
-- El DDL usa CHAR(36) para UUID generados por Node, conserva los identificadores
-- de producto y venta de origen como texto, y mantiene la FK compuesta que impide
-- asociar una venta con la importación de otro propietario.

CREATE TABLE IF NOT EXISTS usuarios (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'cliente',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_correo (correo),
  KEY ix_usuarios_rol (rol),
  CONSTRAINT ck_usuarios_id_uuid CHECK (
    id COLLATE ascii_bin REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  CONSTRAINT ck_usuarios_nombre CHECK (CHAR_LENGTH(TRIM(nombre)) BETWEEN 1 AND 120),
  CONSTRAINT ck_usuarios_correo CHECK (
    BINARY correo = BINARY LOWER(correo) AND CHAR_LENGTH(correo) BETWEEN 3 AND 254
  ),
  CONSTRAINT ck_usuarios_hash CHECK (password_hash LIKE '$argon2id$%'),
  CONSTRAINT ck_usuarios_rol CHECK (rol IN ('cliente', 'administrador')),
  CONSTRAINT ck_usuarios_activo CHECK (activo IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categorias (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(60) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_nombre (nombre),
  CONSTRAINT ck_categorias_nombre CHECK (CHAR_LENGTH(TRIM(nombre)) BETWEEN 1 AND 60)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS productos (
  id VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  categoria_id SMALLINT UNSIGNED NOT NULL,
  precio_actual_mxn DECIMAL(12,2) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_productos_categoria (categoria_id),
  CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id)
    REFERENCES categorias (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_productos_id CHECK (
    id COLLATE ascii_bin REGEXP '^[A-Z]{1,3}[0-9]{3}$'
  ),
  CONSTRAINT ck_productos_nombre CHECK (CHAR_LENGTH(TRIM(nombre)) BETWEEN 1 AND 120),
  CONSTRAINT ck_productos_precio CHECK (
    precio_actual_mxn > 0 AND precio_actual_mxn <= 1000000
  ),
  CONSTRAINT ck_productos_activo CHECK (activo IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS importaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conjunto VARCHAR(80) NOT NULL,
  archivo VARCHAR(255) NOT NULL,
  hash_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  perfil_demanda VARCHAR(80) NOT NULL,
  fuente VARCHAR(40) NOT NULL DEFAULT 'datos_simulados',
  es_demostracion TINYINT(1) NOT NULL DEFAULT 1,
  moneda CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'MXN',
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  cantidad_registros INT NOT NULL,
  propietario_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  importado_por CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  importado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_importaciones_conjunto (conjunto),
  UNIQUE KEY uq_importaciones_hash (hash_sha256),
  UNIQUE KEY uq_importaciones_id_propietario (id, propietario_id),
  KEY ix_importaciones_propietario (propietario_id),
  KEY ix_importaciones_importador (importado_por),
  CONSTRAINT fk_importaciones_propietario FOREIGN KEY (propietario_id)
    REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_importaciones_importador FOREIGN KEY (importado_por)
    REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT ck_importaciones_conjunto CHECK (
    CHAR_LENGTH(TRIM(conjunto)) BETWEEN 1 AND 80
  ),
  CONSTRAINT ck_importaciones_archivo CHECK (
    CHAR_LENGTH(TRIM(archivo)) BETWEEN 1 AND 255
  ),
  CONSTRAINT ck_importaciones_hash CHECK (
    hash_sha256 COLLATE ascii_bin REGEXP '^[0-9a-f]{64}$'
  ),
  CONSTRAINT ck_importaciones_perfil CHECK (
    CHAR_LENGTH(TRIM(perfil_demanda)) BETWEEN 1 AND 80
  ),
  CONSTRAINT ck_importaciones_fuente CHECK (
    CHAR_LENGTH(TRIM(fuente)) BETWEEN 1 AND 40
  ),
  CONSTRAINT ck_importaciones_demostracion CHECK (es_demostracion IN (0, 1)),
  CONSTRAINT ck_importaciones_moneda CHECK (moneda = 'MXN'),
  CONSTRAINT ck_importaciones_periodo CHECK (periodo_fin >= periodo_inicio),
  CONSTRAINT ck_importaciones_registros CHECK (cantidad_registros > 0),
  CONSTRAINT ck_importaciones_propietario_uuid CHECK (
    propietario_id COLLATE ascii_bin REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ventas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  importacion_id BIGINT UNSIGNED NULL,
  id_origen VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  propietario_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  fecha DATE NOT NULL,
  producto_id VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  precio_unitario_mxn DECIMAL(12,2) NOT NULL,
  cantidad INT NOT NULL,
  total_mxn DECIMAL(14,2) NOT NULL,
  clave_idempotencia CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ventas_importacion_origen (importacion_id, id_origen),
  UNIQUE KEY uq_ventas_propietario_clave (propietario_id, clave_idempotencia),
  KEY ix_ventas_propietario_fecha (propietario_id, fecha),
  KEY ix_ventas_producto_fecha (producto_id, fecha),
  KEY ix_ventas_fecha (fecha),
  KEY ix_ventas_importacion (importacion_id),
  KEY ix_ventas_importacion_propietario (importacion_id, propietario_id),
  CONSTRAINT fk_ventas_importacion_propietario FOREIGN KEY (importacion_id, propietario_id)
    REFERENCES importaciones (id, propietario_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_ventas_propietario FOREIGN KEY (propietario_id)
    REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_ventas_producto FOREIGN KEY (producto_id)
    REFERENCES productos (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_ventas_origen CHECK (
    (importacion_id IS NULL) = (id_origen IS NULL)
  ),
  CONSTRAINT ck_ventas_origen_texto CHECK (
    id_origen IS NULL OR (
      CHAR_LENGTH(TRIM(id_origen)) BETWEEN 1 AND 64 AND
      id_origen COLLATE ascii_bin REGEXP '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'
    )
  ),
  CONSTRAINT ck_ventas_propietario_uuid CHECK (
    propietario_id COLLATE ascii_bin REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  CONSTRAINT ck_ventas_fecha CHECK (fecha >= '2000-01-01'),
  CONSTRAINT ck_ventas_cantidad CHECK (cantidad BETWEEN 1 AND 10000),
  CONSTRAINT ck_ventas_precio CHECK (
    precio_unitario_mxn > 0 AND precio_unitario_mxn <= 1000000
  ),
  CONSTRAINT ck_ventas_total CHECK (total_mxn > 0 AND total_mxn <= 10000000),
  CONSTRAINT ck_ventas_total_coherente CHECK (
    ABS(total_mxn - (precio_unitario_mxn * cantidad)) <= 0.01
  ),
  CONSTRAINT ck_ventas_clave_uuid CHECK (
    clave_idempotencia IS NULL OR
    clave_idempotencia COLLATE ascii_bin REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
) ENGINE=InnoDB;
