// quota-guard.js - Kota Yönetimi ve Güvenlik (Faz 4 / Madde 5f)

export class QuotaGuard {
    constructor() {
        // MVP için statik token bütçesi (İleride Redis veya tasks.json üzerinden okunabilir)
        this.codexDailyLimit = 500000;
        this.claudeDailyLimit = 100000;
        
        this.usedCodex = 0;
        this.usedClaude = 0;
    }

    // Görev öncesi kotanın yeterli olup olmadığını kontrol eder
    canAcceptTask(task) {
        if (task.tier === 3) {
            // Claude (Tier 3)
            return (this.usedClaude + (task.max_tokens || 10000)) <= this.claudeDailyLimit;
        } else {
            // Codex (Tier 1/2)
            return (this.usedCodex + (task.max_tokens || 20000)) <= this.codexDailyLimit;
        }
    }

    // Görev bitiminde kullanılan tokenları kaydeder
    recordUsage(tier, tokensUsed) {
        if (tier === 3) {
            this.usedClaude += tokensUsed;
        } else {
            this.usedCodex += tokensUsed;
        }
        console.log(`[Quota] Güncel Kullanım -> Codex: ${this.usedCodex}, Claude: ${this.usedClaude}`);
    }

    // Fable'ın Sorusu: Her iki kota biterse ne olur?
    // Cevap: Sistem 'Exhausted' (Tükenmiş) moduna girer, dispatcher yeni görev almayı reddeder ve tüm kuyruğu sabaha (insana) devreder.
    isExhausted() {
        return (this.usedCodex >= this.codexDailyLimit) && (this.usedClaude >= this.claudeDailyLimit);
    }
}
