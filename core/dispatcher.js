import 'dotenv/config';
import fs from 'fs/promises';
import { exec } from 'child_process';
import util from 'util';

function execAsync(command) {
    return new Promise((resolve, reject) => {
        const child = exec(command, { maxBuffer: 1024 * 1024 * 50 }); // 50MB buffer
        
        // Sadece agy komutlarının loglarını canlı ekrana basalım
        if (command.includes('agy')) {
            child.stdout.pipe(process.stdout);
            child.stderr.pipe(process.stderr);
        }

        let stdoutData = '';
        child.stdout.on('data', data => stdoutData += data);

        child.on('close', code => {
            if (code !== 0) reject(new Error(`Command failed with code ${code}`));
            else resolve({ stdout: stdoutData });
        });
    });
}

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

async function updateTaskInJson(updatedTask) {
    const raw = await fs.readFile(TASKS_FILE, 'utf-8');
    let tasks = JSON.parse(raw);
    const index = tasks.findIndex(t => t.id === updatedTask.id);
    if (index !== -1) {
        tasks[index] = updatedTask;
        await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
    }
}

async function dispatchTask(task) {
    console.log(`\n[Dispatch] Görev başlatılıyor: ${task.id} (Tier: ${task.tier})`);
    
    if (!quotaGuard.canAcceptTask(task)) {
        console.log(`[Kota] Yetersiz token bütçesi. ${task.id} başlatılamadı.`);
        return false; // Başarısız
    }

    // Arayüz (UI) için görevi In Progress'e çekiyoruz
    task.status = 'in_progress';
    await updateTaskInJson(task);

    if (task.tier === "auto") {
        console.log(`[Analiz] Tier 3 Mimar ajan ${task.id} görevini analiz ediyor...`);
        try {
            const analysisPrompt = `Aşağıdaki yazılım görevini analiz et ve zorluğuna göre sadece 1, 2 veya 3 rakamlarından birini dön. (1: Basit test/ufak değişiklik, 2: Standart özellik, 3: Mimari/Büyük sistem değişikliği). Başka hiçbir kelime veya açıklama yazma. Görev: ${task.description}`;
            const result = await execAsync(`agy --model "Claude Sonnet 4.6 (Thinking)" --print "${analysisPrompt}"`);
            const suggestedTier = parseInt(result.stdout.trim().replace(/[^123]/g, '')) || 2;
            task.tier = suggestedTier;
            console.log(`[Analiz] ${task.id} görevi için Mimar'ın belirlediği seviye: Tier ${suggestedTier}`);
            await updateTaskInJson(task);
        } catch (err) {
            console.error(`[Analiz Hatası] Otomatik tier belirlenemedi, varsayılan Tier 2 atanıyor.`, err.message);
            task.tier = 2;
            await updateTaskInJson(task);
        }
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
            if (task.tier === 3) model = "Claude Sonnet 4.6 (Thinking)";
            else if (task.tier === 2) model = "Gemini 3.1 Pro (High)";
            else model = "Gemini 3.5 Flash (High)";
            
            console.log(`[Executor] AGY (${model}) modeline devrediliyor: ${task.id} (Slot: ${slot.id}) - Deneme ${retries}/${task.max_retries || 3}`);
            
            try {
                // Ajanın sistem promptu ve görev tanımı
                let prompt = `Sen bir uygulayıcı (Implementer) ajansın. Mevcut dizin bir git worktree'sidir. Sadece bu görevi yapacaksın: ${task.description}`;
                if (task.use_goal) {
                    prompt = `/goal ${prompt}`;
                    console.log(`[AGY] 🎯 /goal parametresi aktif! Ajan derin iterasyon (Deep Iteration) modunda çalışacak.`);
                }
                
                // agy CLI ile ajanı headless (print) modda başlat.
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
                task.status = 'completed_and_merged';
                await updateTaskInJson(task);
                await fs.appendFile(PROGRESS_FILE, JSON.stringify({
                    taskId: task.id,
                    status: 'completed_and_merged',
                    timestamp: new Date().toISOString()
                }) + '\n');
            } else {
                console.log(`[Dead-Letter] ${task.id} testlerden geçti ancak develop'a MERGE EDİLEMEDİ! Manuel onaya düştü.`);
                task.status = 'failed';
                await updateTaskInJson(task);
            }
        } else {
            console.log(`\n[Eskalasyon] ${task.id} maksimum deneme sınırına (${task.max_retries || 3}) ulaştı!`);
            if (task.tier < 3) {
                console.log(`[Eskalasyon] ÇÖZÜM 1: Görev Tier 3'e yükseltildi.`);
                task.tier = 3;
                task.status = 'pending'; // Yeniden sıraya al
                await updateTaskInJson(task);
            } else {
                console.log(`[Dead-Letter] ÇÖZÜM 2: Görev zaten en yüksek Tier'da çözülemedi. İnsan onayı bekleniyor.`);
                task.status = 'failed';
                await updateTaskInJson(task);
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
                // Eğer boş slot kalmadıysa diğer pending görevleri şimdilik pas geç
                const freeSlots = wtManager.slots.filter(s => !s.busy);
                if (freeSlots.length === 0) {
                    console.log(`[Sistem] Bütün ajan slotları dolu! ${task.id} bekletiliyor...`);
                    break;
                }

                console.log(`[Dispatcher] ${task.id} paralel olarak başlatılıyor...`);
                // AWAIT YOK! Görevi arkaplanda ateşliyoruz (Fire and forget)
                dispatchTask(task).catch(err => console.error(`[Dispatch Hatası]`, err));
                
                // Dosya yazma (updateTaskInJson) çakışmalarını önlemek için küçük bir bekleme
                await new Promise(resolve => setTimeout(resolve, 500));
                
                quotaGuard.recordUsage(task.tier, task.max_tokens || 1000);
            }
        }
    } catch (e) {
        console.error('Hata:', e.message);
        if (e.code === 'ENOENT') {
            console.log('tasks.json bulunamadı. Lütfen önce Claude ile bir görev dosyası oluşturun.');
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
export { main as runDispatcher };
