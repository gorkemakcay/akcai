import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';

const execAsync = util.promisify(exec);

// Worktree Manager - Kalıcı Slot Mimarisi (Faz 4/5l)
// Diski doldurmamak için her görevde worktree oluştur/sil yerine 4-6 sabit klasör tutulur.
// DB istenirse o slota ait "db_template" tabanlı bir Postgres konteyneri canlandırılır.

const SLOTS_COUNT = 4;
const WORKTREE_BASE_DIR = '../agent-slots';

export class WorktreeManager {
    constructor() {
        this.slots = Array(SLOTS_COUNT).fill(null).map((_, i) => ({
            id: `slot-${i + 1}`,
            path: `${WORKTREE_BASE_DIR}/slot-${i + 1}`,
            busy: false,
            dbContainer: `loop_db_slot_${i + 1}`
        }));
    }

    // Sistemin ilk kurulumunda 4 kalıcı slot oluşturur
    async initializeSlots() {
        console.log(`[Worktree] ${SLOTS_COUNT} adet kalıcı ajan slotu hazırlanıyor...`);
        // TODO: Gerçekte 'git worktree add' komutlarıyla klasörleri yaratacak
        // Örn: git worktree add ./agent-slots/slot-1 main
    }

    // Boş bir slot bulup o göreve (branch'e) tahsis eder
    async assignTaskToSlot(taskId, branchName, dbRequired = false) {
        const freeSlot = this.slots.find(s => !s.busy);
        if (!freeSlot) {
            throw new Error('[Worktree] Tüm slotlar dolu, görev bekletilmeli.');
        }

        freeSlot.busy = true;
        console.log(`[Worktree] ${taskId} görevi ${freeSlot.id} klasörüne (Branch: ${branchName}) atandı.`);
        
        // Workspace-Sync (Faz 4): Slot'un develop branch'i geride kalmasın diye önce senkronize edilir
        console.log(`[Git] ${freeSlot.id} güncelleniyor (Workspace-Sync)...`);
        // await execAsync(`cd ${freeSlot.path} && git checkout develop && git pull origin develop`);
        
        // Slot içinde yeni görev branch'ini aç (ROTASYON mantığı)
        // await execAsync(`cd ${freeSlot.path} && git checkout -b ${branchName}`);

        if (dbRequired) {
            console.log(`[Docker] ${taskId} için izole DB konteyneri ayağa kaldırılıyor: ${freeSlot.dbContainer}`);
            // Faz 4 / Madde 5l: Native Docker Engine ile DB Container oluşturma
            try {
                // Konteyner zaten varsa sil
                await execAsync(`docker rm -f ${freeSlot.dbContainer} || true`);
                // Şablon imajdan (migration beklememek için) DB ayağa kaldır
                await execAsync(`docker run -d --name ${freeSlot.dbContainer} -e POSTGRES_PASSWORD=loop -p 5432 postgres:15-alpine`);
                console.log(`[Docker] DB Hazır! Host portu otomatik eşlendi.`);
            } catch (error) {
                console.error(`[Docker] Veritabanı başlatılamadı:`, error.message);
            }
        }

        return freeSlot;
    }

    // Görevin branch'ini develop branch'ine merge etmeyi dener
    async attemptMergeToDevelop(slotId, branchName) {
        const slot = this.slots.find(s => s.id === slotId);
        if (!slot) throw new Error("Slot bulunamadı.");

        console.log(`[Git] ${slot.id} üzerindeki ${branchName} branch'i develop'a merge edilmeye çalışılıyor...`);
        
        try {
            // Develop branch'ine geç ve güncelle
            await execAsync(`cd ${slot.path} && git checkout develop && git pull origin develop`);
            // Görev branch'ini develop'a merge et (Fast-forward veya No-ff)
            await execAsync(`cd ${slot.path} && git merge ${branchName} --no-edit`);
            console.log(`[Git] Merge başarılı! Conflict yok.`);
            return true;
        } catch (error) {
            console.error(`[Git] Merge BAŞARISIZ! Conflict veya ağ hatası.`);
            // Merge iptal ediliyor ki worktree kirli kalmasın
            await execAsync(`cd ${slot.path} && git merge --abort`).catch(() => {});
            return false;
        }
    }

    // Görev bittiğinde slotu diğer görevlere açar ve DB'yi uçurur
    async releaseSlot(slotId) {
        const slot = this.slots.find(s => s.id === slotId);
        if (slot) {
            console.log(`[Worktree] ${slot.id} serbest bırakıldı.`);
            try {
                // İzole veritabanı yok ediliyor (veri kalıcı değil, template'ten baştan oluşur)
                await execAsync(`docker rm -f ${slot.dbContainer} || true`);
            } catch(e) {}
            slot.busy = false;
        }
    }
}
