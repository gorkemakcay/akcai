import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3030;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TASKS_FILE = path.join(__dirname, '../../tasks.json');
const PROGRESS_FILE = path.join(__dirname, '../../progress.jsonl');

// API: Görevleri Getir
app.get('/api/tasks', async (req, res) => {
    try {
        const data = await fs.readFile(TASKS_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Dosya okunamadı' });
    }
});

// API: Görevleri Güncelle
app.post('/api/tasks', async (req, res) => {
    try {
        await fs.writeFile(TASKS_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Dosya yazılamadı' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎨 Akcai Kanban UI çalışıyor: http://localhost:${PORT}`);
});
