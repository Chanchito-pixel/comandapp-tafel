-- ════════════════════════════════════════════════════════
--  schema.sql  —  Ejecutar en pgAdmin4: Query Tool
--  Base de datos: comandapp (crearla antes en pgAdmin4)
-- ════════════════════════════════════════════════════════

-- ── Tabla: empleados ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS empleados (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    apellido    VARCHAR(100) NOT NULL,
    dni         VARCHAR(20),
    telefono    VARCHAR(20),
    mail        VARCHAR(150),
    rol         VARCHAR(20) NOT NULL
                CHECK(rol IN ('owner','mozo','cocina')),
    pass_hash   TEXT NOT NULL,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Tabla: mesas ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesas (
    id          SERIAL PRIMARY KEY,
    numero      INTEGER NOT NULL UNIQUE,
    capacidad   INTEGER NOT NULL DEFAULT 4,
    estado      VARCHAR(20) NOT NULL DEFAULT 'libre'
                CHECK(estado IN ('libre','ocupada','reservada')),
    creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Tabla: menu ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    precio      NUMERIC(10,2) NOT NULL DEFAULT 0,
    disponible  BOOLEAN NOT NULL DEFAULT TRUE,
    descripcion TEXT,
    categoria   VARCHAR(50) NOT NULL DEFAULT 'General',
    creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Tabla: comandas ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS comandas (
    id              SERIAL PRIMARY KEY,
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                    CHECK(estado IN ('pendiente','aceptada','rechazada','lista','entregada')),
    id_mesa         INTEGER REFERENCES mesas(id) ON DELETE SET NULL,
    id_mozo         INTEGER REFERENCES empleados(id) ON DELETE SET NULL,
    observaciones   TEXT,
    total           NUMERIC(10,2) NOT NULL DEFAULT 0,
    creado_en       TIMESTAMP NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Tabla: detalle_comanda ───────────────────────────────
CREATE TABLE IF NOT EXISTS detalle_comanda (
    id              SERIAL PRIMARY KEY,
    id_comanda      INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
    id_producto     INTEGER NOT NULL REFERENCES menu(id) ON DELETE RESTRICT,
    cantidad        INTEGER NOT NULL DEFAULT 1 CHECK(cantidad > 0),
    precio_unidad   NUMERIC(10,2) NOT NULL
);
