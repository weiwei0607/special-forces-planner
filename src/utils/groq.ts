const KEY_STORAGE = 'sf_groq_key';

export function getGroqKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || '';
  } catch {
    return ''; // 無痕模式等 localStorage 被封鎖的情況
  }
}
export function saveGroqKey(key: string) {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    // 存不了就算了，金鑰輸入框當次還是能用
  }
}

export interface AISpot {
  name: string;
  duration: number;
  open: string;
  close: string;
  address: string;
  price: number;
  arrive: string;
  tip: string;
  transit: string;
}

export interface AIDay {
  day: number;
  area: string;
  spots: AISpot[];
}

const BUDGET_PROMPT = {
  free: '免費優先：只推薦免費或極低消費景點，便利商店/超市解決三餐，不排任何門票超過300台幣（約1500日圓）的付費景點，teamlab/skytree/迪士尼/環球影城一律不排',
  mid: '中等預算：可安排少量付費景點（門票≤500台幣/2500日圓），加一頓像樣的午餐或晚餐，不排主題樂園類高價景點',
  any: '不限預算：推薦真正值得去的地方，可含特色餐廳或體驗，但避免純觀光陷阱',
};

const STYLE_PROMPT = {
  hard: `特種兵模式（社群媒體流行的極限旅遊打法）：
- 第一天搭首班地鐵/電車出發（通常05:30-06:00），在景點門口等開門
- 每天8-12個景點，行程從天亮排到天黑（06:00-22:00）
- 三餐用便利商店、超市、路邊攤解決（邊走邊吃），不安排正式用餐時間
- 路線按地理位置順時針或逆時針安排，不走回頭路
- 每個景點之間交通時間盡量壓在20分鐘以內
- 同一天集中在1-2個相鄰區域，不跨越城市的大範圍移動`,

  medium: `輕鬆模式：
- 早上09:00出發，晚上21:00前結束
- 每天4-6個景點（含1-2個主要景點+周邊散步）
- 安排一頓正式午餐（12:00-13:30）和一頓晚餐（18:00-19:30），可以是特色餐廳
- 景點之間留緩衝時間，不趕時間
- 同一天集中在1個區域深度遊覽`,
};

export async function generateItinerary(params: {
  destination: string;
  days: number;
  budget: 'free' | 'mid' | 'any';
  style: 'hard' | 'medium';
  apiKey: string;
}): Promise<AIDay[]> {
  const { destination, days, budget, style, apiKey } = params;

  const prompt = `你是資深旅遊規劃師，專精${destination}在地交通與景點。請用繁體中文回答。

目的地：${destination}，共${days}天
風格：${STYLE_PROMPT[style]}
預算：${BUDGET_PROMPT[budget]}

===路線規劃原則===
1. 先判斷${destination}的主要交通工具（地鐵/MRT/JR/公車），優先用大眾運輸
2. 同一天景點必須在地理上相鄰，按「最短路徑」排序（不走回頭路）
3. transit 欄位必須寫具體：搭哪條線、哪站上車、哪站下車、幾分鐘、出站後步行幾分鐘
   範例：「搭JR山手線[池袋→上野]約14分鐘，出中央口步行3分鐘」
   範例：「搭台北捷運板南線[西門→忠孝敦化]約8分鐘，2號出口步行5分鐘」
4. arrive 欄位填算好的實際抵達時刻（考慮前一個景點停留時間+交通時間）
5. 最後一個景點的 transit 填「返回住宿：」+回程交通方式
6. 不可安排已關閉或需提前預約的景點（除非tip中說明預約方式）

回傳純 JSON 陣列（不要說明或 markdown，直接從 [ 開始）：
[{
  "day": 1,
  "area": "今日主要區域名稱",
  "spots": [{
    "name": "景點名稱（當地語言+中文）",
    "duration": 60,
    "open": "09:00",
    "close": "17:00",
    "address": "詳細地址或最近車站",
    "price": 0,
    "arrive": "09:00",
    "tip": "實用提示（省錢方法/注意事項/最佳拍照時間）",
    "transit": "→ 搭[交通工具+路線][起站→終站]約X分鐘，步行Y分鐘"
  }]
}]

共生成 ${days} 天完整行程，每天景點數量符合上述風格定義。`;

  let res: Response;
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 8192,
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (e: any) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      throw new Error('AI 服務逾時，請稍後再試');
    }
    throw new Error('無法連線到 AI 服務，請檢查網路連線');
  }

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
