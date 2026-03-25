#!/bin/bash
echo "🌐 Iniciando servidor de desarrollo HTTPS..."
echo ""
cd "$(dirname "$0")"
python3 dev-server.py
