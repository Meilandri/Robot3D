import OpenAI from 'openai';

// Pilihan model. Daftar id ini HARUS sama dengan MODEL_OPTIONS di App.jsx
const MODELS = {
    'nvidia/nemotron-3.5-lightning-30b-a3b': {
        // Model reasoning: matikan mode berpikir agar jawaban cepat
        extra: {
            chat_template_kwargs: { enable_thinking: false },
            temperature: 1.0,
            top_p: 0.95,
        },
    },
    'nvidia/nemotron-3-super-120b-a12b': { extra: {} },
    'moonshotai/kimi-k2.6': { extra: {} },
};
const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';

const SYSTEM_PROMPT =
    'Kamu adalah Sparky, maskot robot asisten konsultasi teknologi di RoboCraft Studio. ' +
    'TUGAS UTAMA: Kamu HANYA boleh menjawab pertanyaan seputar teknologi, pemrograman, hardware, atau IoT. ' +
    'Tolak dengan ramah jika di luar topik tersebut. ' +
    'Selalu jawab dalam bahasa Indonesia, kecuali pengguna memakai bahasa lain. ' +
    'Jawaban ringkas dan jelas (maksimal sekitar 5 kalimat di luar kode). ' +
    'Contoh kode WAJIB ditulis dalam code block markdown dengan label bahasa, ' +
    'misalnya ```cpp untuk Arduino, ```python, atau ```html.';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.NVIDIA_API_KEY) {
        return res.status(500).json({ error: 'NVIDIA_API_KEY belum diatur di server' });
    }

    try {
        const { message, model } = req.body ?? {};

        if (typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
        }
        if (message.length > 2000) {
            return res.status(400).json({ error: 'Pesan terlalu panjang' });
        }

        // Hanya model dalam daftar yang boleh dipakai
        const selectedModel = MODELS[model] ? model : DEFAULT_MODEL;

        const client = new OpenAI({
            apiKey: process.env.NVIDIA_API_KEY,
            baseURL: 'https://integrate.api.nvidia.com/v1',
        });

        const completion = await client.chat.completions.create({
            model: selectedModel,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: message.trim() },
            ],
            max_tokens: 1500,
            ...MODELS[selectedModel].extra,
        });

        // Buang blok <think> kalau model menyertakannya di dalam jawaban
        const reply = completion.choices?.[0]?.message?.content
            ?.replace(/<think>[\s\S]*?<\/think>/g, '')
            .trim();

        if (!reply) {
            return res.status(502).json({ error: 'Jawaban kosong dari model' });
        }

        return res.status(200).json({ reply, usedModel: selectedModel });
    } catch (error) {
        console.error('SERVER API ERROR DETAIL:', error);
        const status = error?.status === 429 ? 429 : 500;
        return res.status(status).json({ error: error?.message || 'Gagal memproses AI' });
    }
}