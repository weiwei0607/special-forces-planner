const KEY_STORAGE = 'sf_groq_key';

export function getGroqKey() {
  return localStorage.getItem(KEY_STORAGE) || '';
}
export function saveGroqKey(key: string) {
  localStorage.setItem(KEY_STORAGE, key);
}

export interface AISpot {
  name: string;
  duration: number;
  open: string;
  close: string;
  address: string;
  price: number;
  tip: string;
  transit: string;
}

export interface AIDay {
  day: number;
  spots: AISpot[];
}

const BUDGET_PROMPT = {
  free: '預算非常有限，只推薦免費景點（price=0），絕對不要推薦門票超過500日圓的付費景點（teamlab、skytree展望台、迪士尼等高價景點一律不排）',
  mid: '中等預算，可安排少量付費景點（門票≤2000日圓），不推薦teamlab、環球影城、迪士尼等高價樂園',
  any: '不限預算，但仍注重性價比，推薦真正值得去的地方',
};

export async function generateItinerary(params: {
  destination: string;
  days: number;
  budget: 'free' | 'mid' | 'any';
  style: 'hard' | 'medium';
  apiKey: string;
}): Promise<AIDay[]> {
  const { destination, days, budget, style, apiKey } = params;

  const styleText =
    style === 'hard'
      ? '特種兵（每天10-12個景點，從早玩到晚，塞滿每一分鐘）'
      : '適中（每天5-7個景點，有時間吃飯休息）';

  const prompt = `你是特種兵旅遊達人，請用繁體中文回答。
目的地：${destination}，天數：${days}天
風格：${styleText}
預算限制：${BUDGET_PROMPT[budget]}

回傳純 JSON 陣列（不要任何說明或 markdown，直接從 [ 開始）：
[{"day":1,"spots":[{"name":"景點中文名","duration":90,"open":"09:00","close":"17:00","address":"地址","price":0,"tip":"小提示（省錢方法/注意事項）","transit":"→下一站：交通方式+時間（最後一個填空）"}]}]

嚴格規則：
- 考慮開館/閉館時間，算好抵達時刻確保在開放時間內
- 第一個景點最早09:00開始
- 同一天景點集中在同一區，減少跨區移動
- price 填門票日幣（免費=0）
- 共生成 ${days} 天完整行程`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq 錯誤 ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string = data.choices[0].message.content;

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('AI 回應格式錯誤，請重試');

  return JSON.parse(match[0]) as AIDay[];
}
