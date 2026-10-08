import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
        }

        // Pastikan memanggil process.env.GEMINI_API_KEY
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: message,
            config: {
                systemInstruction:
                    "Kamu adalah maskot robot asisten konsultasi teknologi di RoboCraft Studio. " +
                    "TUGAS UTAMA: Kamu HANYA boleh menjawab pertanyaan seputar teknologi, pemrograman, hardware, atau IoT. " +
                    "Tolak dengan ramah jika di luar topik tersebut.",
            },
        });

        return res.status(200).json({ reply: response.text });
    } catch (error) {
        console.error('SERVER API ERROR DETAIL:', error);
        return res.status(500).json({ error: error.message || 'Gagal memproses AI' });
    }
}