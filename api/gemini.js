const MODEL = 'gemini-3.6-flash';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: 'サーバーにGEMINI_API_KEYが設定されていません。' } });
    return;
  }

  const { system, messages, max_tokens } = req.body || {};
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: { message: 'messagesが不正です。' } });
    return;
  }

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const body = {
    contents,
    generationConfig: { maxOutputTokens: max_tokens || 300 }
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: { message: (data && data.error && data.error.message) || 'Gemini APIエラー' }
      });
      return;
    }

    const candidate = data.candidates && data.candidates[0];
    const text = candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts.map(p => p.text || '').join('')
      : '';

    if (!text) {
      const blockReason = data.promptFeedback && data.promptFeedback.blockReason;
      res.status(502).json({
        error: { message: blockReason ? `応答がブロックされました: ${blockReason}` : 'Geminiからの応答が空でした。' }
      });
      return;
    }

    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || String(err) } });
  }
};
