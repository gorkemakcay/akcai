#!/bin/bash

# Loop Orchestra - Proje Başlatma Betiği (Faz 7)
# Bu betik, mevcut bir projeye (örn: ~/projects/my-app) otonom ajan mimarisini kurar.

set -e

if [ -z "$1" ]; then
  echo "Kullanım: ./init.sh <hedef_proje_dizini>"
  echo "Örnek: ./init.sh ../benim-yeni-projem"
  exit 1
fi

TARGET_DIR=$(realpath "$1")

if [ ! -d "$TARGET_DIR" ]; then
  echo "Hata: Hedef dizin bulunamadı: $TARGET_DIR"
  exit 1
fi

echo "Loop Orchestra, $TARGET_DIR projesine entegre ediliyor..."

# 1. Gerekli klasörlerin oluşturulması
mkdir -p "$TARGET_DIR/.loop-orchestra/core/prompts"
mkdir -p "$TARGET_DIR/agent-slots"

# 2. Çekirdek dosyaların kopyalanması
cp -r ./core/* "$TARGET_DIR/.loop-orchestra/core/"
cp ./package.json "$TARGET_DIR/.loop-orchestra/"
cp ./.env.example "$TARGET_DIR/.loop-orchestra/"
cp ./AGENTS.md "$TARGET_DIR/"
cp ./CLAUDE.md "$TARGET_DIR/"

# 3. Örnek tasks.json oluşturulması (varsa atla)
if [ ! -f "$TARGET_DIR/tasks.json" ]; then
  cp ./tasks.json "$TARGET_DIR/"
  echo "Örnek tasks.json oluşturuldu."
fi

echo ""
echo "✅ Kurulum Tamamlandı!"
echo "Lütfen şu adımları izleyin:"
echo "1. cd $TARGET_DIR/.loop-orchestra"
echo "2. cp .env.example .env (ve içini doldurun)"
echo "3. npm install"
echo "4. npm start (Dispatcher'ı başlatmak için)"
