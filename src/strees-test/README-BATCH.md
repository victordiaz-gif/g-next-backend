# 🚀 Script de Importación Rápida - Batches de 1000

## 📋 ¿Qué hace diferente este script?

Este script (`import-products-batch-1000.ts`) importa productos en **lotes de 1000** en lugar de uno por uno, lo que lo hace **20-50 veces más rápido**.

### Comparación:

| Aspecto | Script Original | Script Optimizado |
|---------|----------------|-------------------|
| **Método** | 1 producto por transacción | 1000 productos por transacción |
| **Transacciones** | 50,000 | 50 |
| **Velocidad** | ~50/min | **~1000-3000/min** |
| **Tiempo estimado** | 16-20 horas | **15-50 minutos** |

## 🎯 Cómo usar

### 1. Ejecutar el script

```bash
cd /Users/victordiaz/Desktop/GLASS/Projects/glass-next-vendure-backend

# Ejecutar con memoria aumentada
node --max-old-space-size=8192 -r ts-node/register ./src/strees-test/import-products-batch-1000.ts
```

### 2. Ajustar cantidad de productos

Edita la línea 60 del archivo:

```typescript
const TARGET_PRODUCTS = 50000; // Cambiar a la cantidad deseada
```

**Ejemplos:**
- Prueba rápida: `1000`
- Prueba media: `10000`
- Producción: `50000`

### 3. Ajustar tamaño de lote

Edita la línea 61:

```typescript
const BATCH_SIZE = 1000; // Recomendado
```

**Opciones:**
- `500` - Más seguro (menos memoria)
- `1000` - Balance óptimo
- `2000` - Más rápido (requiere más RAM)

## 📊 Ejemplo de salida

```
🚀 Starting FAST products import (batches of 1000)...
💾 Initial memory usage: 150MB heap, 200MB RSS
🔍 Testing database connection...
✅ Database connection verified
🎯 Target: Import 50,000 products in batches of 1000
📊 This will create 50 transactions instead of 50000

📦 Generating all products in memory...
✅ Generated 50,000 products in memory
📊 Starting batch import of 50 batches...

📦 Importing batch 1/50 (1000 products)...
✅ Batch 1/50 completed in 12.3s
📦 Importing batch 2/50 (1000 products)...
✅ Batch 2/50 completed in 11.8s
...

📈 Progress Report:
   - Imported: 10,000 / 50,000 products
   - Progress: 20.0%
   - Speed: 128 products/sec
   - Errors: 0
   - Estimated time remaining: 5.2 minutes
---
```

## ⚡ Optimizaciones implementadas

### 1. Generación en memoria
- Todos los productos se generan primero en memoria
- No se generan dinámicamente durante la importación

### 2. Importación en lotes
- 1000 productos por transacción de base de datos
- Reduce el overhead de red y latencia

### 3. Mejor gestión de memoria
- Garbage collection cada 10 batches
- Liberación de memoria automática

## 🛠️ Solución de problemas

### Error: "Out of memory"

**Solución:** Reducir el tamaño de lote o aumentar memoria

```bash
# Más memoria
node --max-old-space-size=16384 -r ts-node/register ./src/strees-test/import-products-batch-1000.ts

# O reducir batch size a 500
```

### Error: "Timeout"

**Solución:** Aumentar timeout en el script o reducir batch size

```typescript
const BATCH_SIZE = 500; // Más pequeño, más estable
```

### Muy lento

**Causas posibles:**
1. Elasticsearch indexando en tiempo real
2. Conexión de base de datos lenta
3. Recursos del servidor limitados

**Soluciones:**
- Desactivar Elasticsearch durante importación
- Usar un servidor más potente
- Verificar conexión a PostgreSQL

## 📈 Estadísticas esperadas

Con un servidor promedio (2GB RAM, conexión local):

- **1,000 productos**: ~1-2 minutos
- **10,000 productos**: ~5-10 minutos
- **50,000 productos**: ~20-40 minutos

Con un servidor más potente (4GB+ RAM):

- **50,000 productos**: ~15-25 minutos
- **100,000 productos**: ~30-60 minutos

## 🔧 Modificaciones comunes

### Importar solo 10,000 productos

```typescript
const TARGET_PRODUCTS = 10000;
const BATCH_SIZE = 1000;
```

### Usar lotes de 500 (más seguro)

```typescript
const TARGET_PRODUCTS = 50000;
const BATCH_SIZE = 500; // Más estable
```

### Conectar a base de datos remota

No requiere cambios, el script usa la configuración de `vendure-config.ts`

## 📞 Soporte

Si el script falla:
1. Verifica que el servidor de Vendure esté activo
2. Verifica la conexión a PostgreSQL
3. Revisa los logs del backend
4. Considera reducir el batch size

