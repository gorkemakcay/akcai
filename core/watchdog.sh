#!/bin/bash

# watchdog.sh - MVP Watchdog Script (Faz 0)
# Bu script orkestratörün veya Claude/Codex oturumunun yaşayıp yaşamadığını kontrol eder.
# İlk sürüm otomatik restart yapmaz, sadece tespit ve uyarı (Telegram/Log) yapar.

LOG_FILE="../progress.jsonl"
PROCESS_NAME="claude" # Veya dispatcher'ı çalıştıran süreç adı (node, python vs)
CHECK_INTERVAL=300 # 5 dakika

echo "Watchdog başlatıldı. Süreç: $PROCESS_NAME, Kontrol aralığı: $CHECK_INTERVAL saniye."

while true; do
    sleep $CHECK_INTERVAL
    
    if ! pgrep -x "$PROCESS_NAME" > /dev/null; then
        echo "$(date): UYARI - $PROCESS_NAME süreci bulunamadı! Oturum ölmüş olabilir."
        
        # Son durumu log'dan oku (eğer varsa)
        if [ -f "$LOG_FILE" ]; then
            LAST_TASK=$(tail -n 1 "$LOG_FILE")
            echo "Son görev durumu: $LAST_TASK"
        fi
        
        # TODO: Faz 4'te buraya Telegram RObot / push bildirimi entegrasyonu eklenecek.
        # İlk faz (MVP) için log atıp çıkıyoruz.
        exit 1
    fi
done
