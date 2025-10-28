#!/bin/bash

# Script para volver a la base de datos local
echo "🔄 Volviendo a la base de datos local..."

# Restaurar el .env local
cp .env.local.backup .env

echo "✅ Configuración restaurada para local"
echo "📊 Base de datos: g-next-db local"
echo "🌐 Host: localhost:5432"

