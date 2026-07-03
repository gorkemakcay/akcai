import fs from 'fs';
import { runDispatcher } from './dispatcher.js';

const TASKS_FILE = '../tasks.json';
let isRunning = false;

console.log('🤖 Akcai Daemon çalışıyor... tasks.json dosyası izleniyor...');

// İlk çalıştırma
runDispatcherWrapper();

// Dosya izleyici
fs.watch(TASKS_FILE, (eventType) => {
    if (eventType === 'change') {
        runDispatcherWrapper();
    }
});

async function runDispatcherWrapper() {
    if (isRunning) return;
    isRunning = true;
    
    try {
        console.log('\n[Daemon] tasks.json değişikliği algılandı, Dispatcher tetikleniyor...');
        await runDispatcher();
    } catch (err) {
        console.error('[Daemon Hatası]', err);
    } finally {
        isRunning = false;
        console.log('\n[Daemon] Beklemeye geçildi. (Değişiklikleri dinliyor...)');
    }
}
