import 'dotenv/config';
import fs from 'fs/promises';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

// dispatcher.js - MVP Orchestrator (Faz 4)
// Bu dosya tasks.json'ı okur, görevlerin tier'ını belirler ve işi Codex'e delege eder.

const TASKS_FILE = '../tasks.json';
const PROGRESS_FILE = '../progress.jsonl';

async function checkBeforeHandoff(task) {
    console.log(`[Doğrulama] ${task.id} için quality_gates test ediliyor...`);
    if (!task.quality_gates || task.quality_gates.length === 0) {
        console.log(`[Doğrulama] ${task.id} için test bulunamadı, onaylandı.`);
        return true;
    }

    for (const gate of task.quality_gates) {
        try {
            console.log(`Çalıştırılıyor: ${gate}`);
            await execAsync(gate);
        } catch (error) {
            console.error(`[Doğrulama Hatası] ${task.id} - Test başarısız: ${gate}`);
            return false;
        }
    }
    return true;
}

import { WorktreeManager } from './worktree-manager.js';
import { QuotaGuard } from './quota-guard.js';

const wtManager = new WorktreeManager();
const quotaGuard = new QuotaGuard();

async function dispatchTask(task) {
    console.log(`\n[Dispatch] Görev başlatılıyor: ${task.id} (Tier: ${task.tier})`);
    
    if (!quotaGuard.canAcceptTask(task)) {
        console.log(`[Kota] Yetersiz token bütçesi. ${task.id} başlatılamadı.`);
        return false; // Başarısız
    }

    if (task.tier === 3) {
        console.log(`[Uyarı] Tier 3 görevler bu dispatcher tarafından otomatik başlatılamaz (İnteraktif Claude kuralı).`);
        return;
    }

    let slot;
    try {
        const branchName = `task/${task.id}`;
        slot = await wtManager.assignTaskToSlot(task.id, branchName, task.db_required);
        
        let retries = 0;
        let isValid = false;
        
        // Eskalasyon Döngüsü (Faz 4 / Madde 5o)
        while (retries < (task.max_retries || 3) && !isValid) {
            retries++;
            let model;
            if (task.tier === 3) model = "Claude Opus 4.6 (Thinking)";
            else if (task.tier === 2) model = "Claude Sonnet 4.6 (Thinking)";
            else model = "Gemini 3.5 Flash (High)";
            
            console.log(`[Executor] AGY (${model}) modeline devrediliyor: ${task.id} (Slot: ${slot.id}) - Deneme ${retries}/${task.max_retries || 3}`);
            
            try {
                // Ajanın sistem promptu ve görev tanımı
                const prompt = `Sen bir uygulayıcı (Implementer) ajansın. Mevcut dizin bir git worktree'sidir. Sadece bu görevi yapacaksın: ${task.description}`;
                
                // agy CLI ile ajanı headless (print) modda başlat.
                // --dangerously-skip-permissions flag'i, ajanın terminal araçlarını (dosya yazma vb.) onay beklemeden kullanabilmesini sağlar (TAM OTONOMİ).
                await execAsync(`cd ${slot.path} && agy --model "${model}" --print "${prompt}" --dangerously-skip-permissions`);
                console.log(`[AGY] ${task.id} için ajan çalışmasını tamamladı.`);
            } catch (err) {
                console.error(`[AGY] Ajan çalışırken hata fırlattı:`, err.message);
            }
            
            isValid = await checkBeforeHandoff(task);
            
            if (!isValid && retries < (task.max_retries || 3)) {
                console.log(`[Uyarı] ${task.id} testleri geçemedi, tekrar deneniyor (Sycophancy loop engellemesi)...`);
                // TODO: Context rot engellemek için /rewind (temiz context) adımı buraya eklenecek
            }
        }
        
        if (isValid) {
            console.log(`[Tamamlandı] ${task.id} başarıyla bitirildi ve doğrulandı.`);
            
            // Merge Politikası (Faz 4 / Madde 5m)
            const merged = await wtManager.attemptMergeToDevelop(slot.id, branchName);
            
            if (merged) {
                await fs.appendFile(PROGRESS_FILE, JSON.stringify({
                    taskId: task.id,
                    status: 'completed_and_merged',
                    timestamp: new Date().toISOString()
                }) + '\n');
            } else {
                console.log(`[Dead-Letter] ${task.id} testlerden geçti ancak develop'a MERGE EDİLEMEDİ! Manuel onaya düştü.`);
            }
        } else {
            console.log(`\n[Eskalasyon] ${task.id} maksimum deneme sınırına (${task.max_retries || 3}) ulaştı!`);
            if (task.tier < 3) {
                console.log(`[Eskalasyon] ÇÖZÜM 1: Görev Tier 3'e yükseltildi (Claude Code'a devredildi).`);
                console.log(`[Eskalasyon] Uyarı: Tier 3 otomatik başlatılamayacağı için görev bir sonraki İNTERAKTİF oturuma (sabaha) bekletilecek.`);
                // Gerçek senaryoda burada tasks.json güncellenir: task.tier = 3;
            } else {
                console.log(`[Dead-Letter] ÇÖZÜM 2: Görev zaten en yüksek Tier'da çözülemedi. İnsan onayı bekleniyor.`);
                // TODO: Telegram alarmı atılacak
            }
        }
    } catch (err) {
        console.error(`[Dispatch Hatası] ${err.message}`);
    } finally {
        if (slot) {
            await wtManager.releaseSlot(slot.id);
        }
    }
}

async function main() {
    console.log('Loop Orchestra Dispatcher Başlatıldı...');
    try {
        const raw = await fs.readFile(TASKS_FILE, 'utf-8');
        const tasks = JSON.parse(raw);
        
        for (const task of tasks) {
            if (quotaGuard.isExhausted()) {
                console.log('[Sistem] Kota tamamen tükendi (Exhausted mod). Kalan görevler sabaha (İnsana) bırakıldı.');
                break;
            }

            if (task.status === 'pending') {
                const started = await dispatchTask(task);
                if (started !== false) {
                    // Sahte bir token kullanımı kaydedelim (gerçekte API döner)
                    quotaGuard.recordUsage(task.tier, task.max_tokens || 1000);
                }
            }
        }
    } catch (e) {
        console.error('Hata:', e.message);
        if (e.code === 'ENOENT') {
            console.log('tasks.json bulunamadı. Lütfen önce Claude ile bir görev dosyası oluşturun.');
        }
    }
}

main();
