import { exampleText, type AudioFormat, type VoiceMode } from "./types";

export type TtsExample = {
  title: string;
  text: string;
  mode?: VoiceMode;
  voice?: string;
  instruction?: string;
  description?: string;
  format?: AudioFormat;
  stream?: boolean;
  optimizeTextPreview?: boolean;
};

// Original scripts for the scenarios in the MiMo usage guide.
const chloe: TtsExample = {
  title: "Chloe 英文报喜 · WAV",
  voice: "Chloe",
  text: "You won't believe this. The results are in, and I got top marks! I thought I'd barely make it. Come celebrate with me tonight?",
  instruction: "Keep it bright and quick, as if you can hardly wait to share the news. Let the pitch rise at the end of the first sentence.",
};
const clone: TtsExample = {
  title: "参考录音复刻 · WAV",
  mode: "clone",
  text: "Yes, I picked up lunch on the way home.",
};
const design: TtsExample = {
  title: "年轻男声 · 台词润色",
  mode: "design",
  description: "A young adult man with a clear, relaxed conversational voice.",
  text: "Yes, I picked up lunch on the way home.",
  optimizeTextPreview: true,
};

export const ttsExampleGroups: { label: string; examples: TtsExample[] }[] = [
  {
    label: "自然语言与导演模式",
    examples: [
      { title: "日常旁白", voice: "茉莉", text: exampleText, instruction: "温柔、自然，句间稍作停顿。" },
      { title: "向领导报喜", text: "您猜怎么着？成绩出来了，我拿了第一名！", instruction: "语调轻快上扬，语速稍快。努力稳住声音，却掩不住激动和一点骄傲。" },
      { title: "难题解开后的惊呼", text: "等一下，这次真的跑通了！困了我三天的问题，原来卡在这里！", instruction: "先迟疑，确认成功后高声惊呼，语速突然加快，带点难以置信的得意。" },
      { title: "少年恶作剧", text: "我只把闹钟拨快了五分钟。你要是赢了，赌注照算！", instruction: "明亮活泼的少年声，咬字轻巧，有一点得意和戏谑，念到赌注时尾音上扬。" },
      {
        title: "导演模式 · 祠堂对峙",
        text: "你费尽周折，就是要我听这句话？把门关上。往后，别再提你的真心。",
        instruction: "角色：掌管家族的女性，习惯把关心藏在冷淡背后。\n场景：她在空旷的祠堂拒绝一位来劝她离开的人。\n指导：低声、慢速，咬字清晰，第二句短促。句间长停顿，最后的“真心”用很轻的气声收尾。",
      },
    ],
  },
  {
    label: "整段风格、方言与唱歌",
    examples: [
      { title: "怅然 · 故地重游", text: "(怅然)我又经过那条小路了。旧书店还挂着同一盏灯，只是店里换了人。" },
      { title: "慵懒 · 赖床", text: "(慵懒)窗帘先别拉……再让我躺一会儿，一小会儿就好。" },
      { title: "磁性 · 深夜电台", text: "(磁性)如果你也还醒着，就把音量调低一点。接下来这段故事，我们慢慢听。" },
      { title: "东北话 · 寒风", text: "(东北话)哎呀，这风刮得可真够呛！帽子戴牢点儿，别让它给吹跑喽。" },
      { title: "粤语 · 美食", text: "(粤语)呢间铺头啲蛋挞真系好香，出炉嗰阵，我喺街口都闻得到。" },
      { title: "唱歌 · 中文歌词", text: "(唱歌)晚风吹过小街，灯光落进窗台。今晚的云走得很慢，我在等月亮回来。" },
    ],
  },
  {
    label: "局部音频标签",
    examples: [
      { title: "面试前 · 呼吸和语速变化", text: "(紧张 深呼吸)慢慢来，只是简单做个介绍。(语速加快)姓名、经历、为什么想来，都背熟了。(小声)坏了，简历放哪儿了？" },
      { title: "加班后 · 疲惫与叹气", text: "(疲惫)师傅，到了麻烦叫我一声。[长叹一口气] 我先闭会儿眼。" },
      { title: "追悔 · 停顿与苦笑", text: "我那天要是回了头……[沉默片刻] 也许还能再见一面。[苦笑] 可我没有。" },
      { title: "风雪里 · 喘息与咳嗽", text: "[急促呼吸] 顺着这排脚印往前走。[咳嗽] 手别松开，下一段路风更大。" },
      { title: "市场叫卖 · 提高音量", text: "[提高音量喊话] 刚出锅的糖炒栗子！趁热尝一颗！哎，小心烫手啊！" },
    ],
  },
  {
    label: "预置音色与声音复刻",
    examples: [
      chloe,
      { ...chloe, title: "Chloe 英文报喜 · 实时试听", stream: true },
      clone,
      { ...clone, title: "参考录音复刻 · SSE 兼容", stream: true },
    ],
  },
  {
    label: "声音设计与智能文案",
    examples: [
      { title: "俄语口音 · 简洁描述", mode: "design", description: "A gruff, direct middle-aged man speaking English with a strong Russian accent.", text: "Take the earlier train. The roads will freeze before noon, and we still have a long way to go." },
      { title: "ASMR · 近距离轻声", mode: "design", description: "A young woman with a very soft close-up voice. Speak slowly, with audible breaths and gentle pauses.", text: "Let your shoulders relax. [Whisper] Take a slow breath with me, and let it go." },
      { title: "北方口音 · 老人讲故事", mode: "design", description: "一位年长的男性，带轻微北方口音，嗓音略沙哑，讲故事时语速慢、停顿自然。", text: "我小时候，邮车每周才来一趟。信还在半路上，家门口那棵梨树就已经开花了。" },
      { title: "纪录片旁白 · 只填音色自动写稿", mode: "design", description: "中年男性纪录片旁白，普通话，低沉而清晰，语速沉稳。用一小段文字讲傍晚潮水漫入湿地。", text: "", optimizeTextPreview: true },
      design,
      { ...design, title: "年轻男声 · SSE 兼容", text: "You really thought I wouldn't find out? Put the keys on the table. Please leave.", stream: true },
    ],
  },
];

export const styleTags = [
  { label: "基础情绪", tags: ["开心", "悲伤", "愤怒", "恐惧", "惊讶", "兴奋", "委屈", "平静", "冷漠"] },
  { label: "复合情绪", tags: ["怅然", "欣慰", "无奈", "愧疚", "释然", "嫉妒", "厌倦", "忐忑", "动情"] },
  { label: "整体语调", tags: ["温柔", "高冷", "活泼", "严肃", "慵懒", "俏皮", "深沉", "干练", "凌厉"] },
  { label: "音色倾向", tags: ["磁性", "醇厚", "清亮", "空灵", "稚嫩", "苍老", "甜美", "沙哑", "醇雅"] },
  { label: "人设腔调", tags: ["夹子音", "御姐音", "正太音", "大叔音", "台湾腔"] },
  { label: "方言与角色", tags: ["东北话", "四川话", "河南话", "粤语", "孙悟空", "林黛玉"] },
];

export const inlineTags = [
  { label: "呼吸与节奏", tags: ["吸气", "深呼吸", "叹气", "长叹一口气", "喘息", "屏息", "停顿", "语速加快", "咳嗽"] },
  { label: "情绪状态", tags: ["紧张", "害怕", "激动", "疲惫", "委屈", "撒娇", "心虚", "震惊", "不耐烦"] },
  { label: "发声与音量", tags: ["颤抖", "声音颤抖", "变调", "破音", "鼻音", "气声", "沙哑", "小声", "提高音量喊话"] },
  { label: "笑声与哭声", tags: ["笑", "轻笑", "大笑", "冷笑", "抽泣", "呜咽", "哽咽", "嚎啕大哭"] },
];
