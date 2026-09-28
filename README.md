# Sistema de Autogestión Administrativo

**Trabajo Final Integrador (TFI) / Proyecto de Autogestión Comercial**  
**Autores:** Pérez Joaquín, Risso Aaron  
**Tecnologías:** React, Vite, Node.js, Express.js, Prisma ORM, MySQL  

---

## 📋 Descripción del Proyecto

El **Sistema de Autogestión Administrativo** es una solución integral y moderna diseñada específicamente para microemprendedores y pequeños comercios (almacenes, kioscos, autoservicios, tiendas de barrio). Permite centralizar en una única plataforma web todas las áreas clave del negocio:

1. **Punto de Venta (POS) Ágil:** Proceso de cobro optimizado para concretarse en menos de 45 segundos, con buscador en vivo, códigos de barra/SKU, cálculo de descuentos, métodos de pago, calculadora de vuelto en efectivo y emisión de comprobantes internos imprimibles (ticket térmico).
2. **Catálogo de Productos:** Control integral de artículos, códigos SKU, categorías, márgenes de ganancia, unidades de medida, historial de variaciones de precio y baja lógica.
3. **Gestión de Inventario (Kardex):** Control en tiempo real de existencias, valuación de stock (a costo y precio de venta), registro de movimientos clasificados (ventas, compras, ajustes +/-, devoluciones) y alertas automáticas de reposición por stock mínimo.
4. **Gestión de Compras:** Órdenes de compra a proveedores en estado pendiente o recibida. Recepción atómica con actualización inmediata de existencias y costos unitarios.
5. **Directorio de Proveedores:** Agenda comercial con CUIT, datos de contacto y trazabilidad de compras asociadas.
6. **Control de Caja & Arqueo Diario:** Apertura de turno con fondo inicial, registro automático de cobros en efectivo, movimientos manuales de ingresos/egresos y módulo de arqueo con conciliación entre saldo teórico y dinero contado.
7. **Reportes y Rentabilidad Económica:** Diferenciación precisa entre facturación bruta, Costo de Mercadería Vendida (COGS), Margen Bruto, Gastos Operativos y **Ganancia Neta Estimada**. Exportación directa a CSV e impresión/guardado en PDF.
8. **Seguridad y Roles (RBAC):** Autenticación mediante tokens JWT y contraseñas con hash `bcrypt`. Distinción de perfiles:
   - **Administrador:** Acceso irrestricto a todas las funcionalidades, compras, reportes financieros, usuarios y configuración.
   - **Empleado:** Autorizado para ventas en POS, consulta de productos, existencias y movimientos permitidos.
9. **Configuración del Comercio:** Nombre, CUIT, dirección, teléfono, pie de ticket configurable y parámetros de inventario.
10. **Notificaciones Internas:** Alertas activas por productos con stock bajo o compras pendientes.

---

## 🛠️ Tecnologías Empleadas

- **Frontend:**
  - React 18+ (con Vite)
  - JavaScript moderno (ES Modules)
  - **Vanilla CSS:** Arquitectura modular de estilos (`variables.css`, `layout.css`, `components.css`, `index.css`) con variables CSS, paleta armónica, diseño adaptable (desktop, tablet, móvil) y soporte de impresión de tickets.
  - `lucide-react`: Iconografía SVG moderna y consistente.
  - `recharts`: Gráficos interactivos para el panel de control y reportes de facturación.
- **Backend:**
  - Node.js & Express.js
  - API REST organizada por capas (Rutas, Controladores, Middlewares, Servicios y Acceso a Datos).
  - Prisma ORM 5.x: Mapeo objeto-relacional y consultas transaccionales atómicas (`$transaction`).
  - `bcryptjs`: Hash seguro de contraseñas de usuarios.
  - `jsonwebtoken` (JWT): Manejo seguro de sesiones y autenticación stateless.
- **Base de Datos:**
  - **MySQL 8.0**: Almacenamiento relacional centralizado con integridad referencial, claves foráneas e índices.

---

## 🚀 Puesta en Marcha e Instalación Local

### Requisitos Previos
- Node.js v18 o superior instalado.
- Servidor MySQL 8.0 ejecutándose localmente (puerto 3306).

### 1. Configuración de la Base de Datos MySQL
En su cliente de MySQL o MySQL Workbench, verifique o cree la base de datos:
```sql
CREATE DATABASE IF NOT EXISTS sistema_autogestion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Configuración del Backend
Abra una terminal en la carpeta `backend`:
```bash
cd backend
```
Copie el archivo de ejemplo o configure el archivo `.env`:
```env
PORT=5000
DATABASE_URL="mysql://root:SU_PASSWORD@localhost:3306/sistema_autogestion"
JWT_SECRET="sistema_autogestion_jwt_secret_key_pro_2026"
NODE_ENV=development
```

Instale las dependencias e inicialice el esquema con Prisma:
```bash
npm install
npx prisma db push
```

Ejecute la carga inicial de datos (Seed):
```bash
node src/seed/seed.js
```
*(El seed creará los usuarios iniciales, categorías, productos de muestra con SKU, proveedores, apertura de caja y movimientos iniciales).*

Inicie el servidor backend:
```bash
npm run dev
# o bien: node src/server.js
```
El servidor quedará disponible en `http://localhost:5000`.

---

### 3. Configuración del Frontend
En una segunda terminal, diríjase a la carpeta `frontend`:
```bash
cd frontend
npm install
npm run dev
```
La aplicación web se abrirá en `http://localhost:5173/`.

---

## 👥 Credenciales de Acceso Iniciales

| Usuario | Contraseña | Rol | Nombre Completo |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **ADMINISTRADOR** | Joaquín Pérez |
| `empleado` | `empleado123` | **EMPLEADO** | Aaron Risso |

*(En la pantalla de login dispone además de botones de acceso rápido para evaluar ambos perfiles con un solo clic).*

---

## 🧪 Pruebas de Integración Automatizadas

El proyecto incluye una suite completa de pruebas de integración para validar la consistencia transaccional, stock, cobros en caja y seguridad RBAC:
```bash
cd backend
node src/tests/integration.test.js
```
Esta prueba valida:
- Autenticación JWT y roles.
- Emisión de ventas y decremento atómico de stock.
- Generación de asientos en el Kardex.
- Asentamiento automático de cobro en caja abierta.
- Creación y recepción de compras con aumento de existencias.
- Cálculo de reportes financieros y ganancia neta.
- Bloqueo 403 Forbidden para usuarios no administradores en módulos restringidos.

---

## 📁 Estructura del Repositorio

```text
TFI/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # Modelos relacionales MySQL
│   ├── src/
│   │   ├── config/               # Instancia de conexión Prisma
│   │   ├── controllers/          # Lógica de negocio (auth, sales, products, cash, etc.)
│   │   ├── middlewares/          # Autenticación JWT y control de roles
│   │   ├── routes/               # Endpoints de la API REST
│   │   ├── seed/                 # Carga de datos de demostración
│   │   ├── tests/                # Suite de pruebas automatizadas
│   │   └── server.js             # Servidor Express principal
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/           # Navbar, Sidebar, Modales (Ticket, Perfil, etc.)
│   │   ├── context/              # Contexto global de sesión (AuthContext)
│   │   ├── pages/                # Páginas de cada módulo administrativo
│   │   ├── styles/               # Sistema de diseño con Vanilla CSS
│   │   ├── utils/                # Funciones de formato ARS y cliente de API
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```
