-- Esquema inicial MySQL 8 para Proyecto ReneFULL.
-- Alcance: usuarios, catalogo de productos, importaciones y ventas.
-- Las rutas HTTP y la autenticacion pertenecen al area de Mia-Paola; aquí solo
-- se define y verifica la persistencia compartida.

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('cliente', 'administrador') NOT NULL DEFAULT 'cliente',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email),
  KEY ix_usuarios_rol (rol),
  CONSTRAINT ck_usuarios_nombre CHECK (CHAR_LENGTH(TRIM(nombre)) BETWEEN 1 AND 120),
  CONSTRAINT ck_usuarios_email CHECK (email = LOWER(email) AND CHAR_LENGTH(email) BETWEEN 3 AND 254),
  CONSTRAINT ck_usuarios_hash CHECK (password_hash LIKE '$argon2id$%'),
  CONSTRAINT ck_usuarios_activo CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS productos (
  producto_id VARCHAR(20) NOT NULL,
  producto VARCHAR(160) NOT NULL,
  categoria VARCHAR(80) NOT NULL,
  precio_unitario_mxn DECIMAL(12,2) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (producto_id),
  KEY ix_productos_categoria (categoria),
  CONSTRAINT ck_productos_id CHECK (producto_id REGEXP '^[A-Z]{1,3}[0-9]{3}$'),
  CONSTRAINT ck_productos_nombre CHECK (CHAR_LENGTH(TRIM(producto)) BETWEEN 1 AND 160),
  CONSTRAINT ck_productos_categoria CHECK (CHAR_LENGTH(TRIM(categoria)) BETWEEN 1 AND 80),
  CONSTRAINT ck_productos_precio CHECK (
    precio_unitario_mxn > 0 AND precio_unitario_mxn <= 1000000
  ),
  CONSTRAINT ck_productos_activo CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS importaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conjunto VARCHAR(80) NOT NULL,
  archivo VARCHAR(255) NOT NULL,
  hash_sha256 CHAR(64) NOT NULL,
  perfil_demanda VARCHAR(80) NOT NULL,
  fuente VARCHAR(40) NOT NULL DEFAULT 'datos_simulados',
  es_demostracion TINYINT(1) NOT NULL DEFAULT 1,
  moneda CHAR(3) NOT NULL DEFAULT 'MXN',
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  cantidad_registros INT UNSIGNED NOT NULL,
  propietario_id BIGINT UNSIGNED NOT NULL,
  importado_por BIGINT UNSIGNED NULL,
  importado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_importaciones_conjunto (conjunto),
  UNIQUE KEY uq_importaciones_hash (hash_sha256),
  UNIQUE KEY uq_importaciones_id_propietario (id, propietario_id),
  KEY ix_importaciones_propietario (propietario_id),
  KEY ix_importaciones_importado_por (importado_por),
  CONSTRAINT fk_importaciones_propietario
    FOREIGN KEY (propietario_id) REFERENCES usuarios (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_importaciones_importado_por
    FOREIGN KEY (importado_por) REFERENCES usuarios (id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT ck_importaciones_conjunto CHECK (CHAR_LENGTH(TRIM(conjunto)) BETWEEN 3 AND 80),
  CONSTRAINT ck_importaciones_archivo CHECK (CHAR_LENGTH(TRIM(archivo)) BETWEEN 1 AND 255),
  CONSTRAINT ck_importaciones_hash CHECK (hash_sha256 REGEXP '^[0-9a-f]{64}$'),
  CONSTRAINT ck_importaciones_perfil CHECK (CHAR_LENGTH(TRIM(perfil_demanda)) BETWEEN 1 AND 80),
  CONSTRAINT ck_importaciones_fuente CHECK (fuente = 'datos_simulados'),
  CONSTRAINT ck_importaciones_demostracion CHECK (es_demostracion = 1),
  CONSTRAINT ck_importaciones_moneda CHECK (moneda = 'MXN'),
  CONSTRAINT ck_importaciones_fechas CHECK (periodo_fin >= periodo_inicio),
  CONSTRAINT ck_importaciones_registros CHECK (cantidad_registros > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ventas (
  id_venta BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  importacion_id BIGINT UNSIGNED NULL,
  id_origen VARCHAR(32) NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  producto_id VARCHAR(20) NOT NULL,
  producto VARCHAR(160) NOT NULL,
  categoria VARCHAR(80) NOT NULL,
  precio_unitario_mxn DECIMAL(12,2) NOT NULL,
  cantidad INT UNSIGNED NOT NULL,
  total_mxn DECIMAL(14,2) NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_venta),
  UNIQUE KEY uq_ventas_importacion_origen (importacion_id, id_origen),
  KEY ix_ventas_usuario_fecha (usuario_id, fecha),
  KEY ix_ventas_producto_fecha (producto_id, fecha),
  KEY ix_ventas_fecha (fecha),
  KEY ix_ventas_importacion_usuario (importacion_id, usuario_id),
  CONSTRAINT fk_ventas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_ventas_producto
    FOREIGN KEY (producto_id) REFERENCES productos (producto_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_ventas_importacion_propietario
    FOREIGN KEY (importacion_id, usuario_id)
    REFERENCES importaciones (id, propietario_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_ventas_origen CHECK (
    (importacion_id IS NULL AND id_origen IS NULL)
    OR (importacion_id IS NOT NULL AND id_origen IS NOT NULL)
  ),
  CONSTRAINT ck_ventas_id_origen CHECK (
    id_origen IS NULL OR CHAR_LENGTH(TRIM(id_origen)) BETWEEN 1 AND 32
  ),
  CONSTRAINT ck_ventas_fecha CHECK (fecha >= '2000-01-01'),
  CONSTRAINT ck_ventas_producto CHECK (CHAR_LENGTH(TRIM(producto)) BETWEEN 1 AND 160),
  CONSTRAINT ck_ventas_categoria CHECK (CHAR_LENGTH(TRIM(categoria)) BETWEEN 1 AND 80),
  CONSTRAINT ck_ventas_precio CHECK (
    precio_unitario_mxn > 0 AND precio_unitario_mxn <= 1000000
  ),
  CONSTRAINT ck_ventas_cantidad CHECK (cantidad BETWEEN 1 AND 10000),
  CONSTRAINT ck_ventas_total CHECK (
    total_mxn > 0
    AND total_mxn <= 10000000
    AND total_mxn = ROUND(precio_unitario_mxn * cantidad, 2)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
