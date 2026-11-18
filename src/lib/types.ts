import { z } from "zod";

export const defaultApiBaseUrl = "https://api.xiaomimimo.com/v1";
export const apiBaseUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url("请填写有效的服务地址。")
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, "请填写 HTTP 或 HTTPS 服务地址，地址中请勿包含登录信息或片段。");
export const apiSettingsSchema = z.object({
  apiKey: z.string().trim().optional(),
  baseUrl: apiBaseUrlSchema.optional(),
});

export const voiceModes = ["preset", "design", "clone"] as const;
export type VoiceMode = (typeof voiceModes)[number];
export const presetVoices = [
  {
    id: "mimo_default",
    label: "MiMo 默认",
    description: "中国集群为冰糖，其他集群为 Mia",
    color: "peach",
  },
  {
    id: "茉莉",
    description: "柔和细腻",
    language: "中文",
    gender: "女声",
    color: "peach",
  },
  {
    id: "冰糖",
    description: "清亮甜美",
    language: "中文",
    gender: "女声",
    color: "yellow",
  },
  {
    id: "苏打",
    description: "明朗自然",
    language: "中文",
    gender: "男声",
    color: "blue",
  },
  {
    id: "白桦",
    description: "沉稳温润",
    language: "中文",
    gender: "男声",
    color: "green",
  },
  {
    id: "Mia",
    description: "自然亲切",
    language: "英文",
    gender: "女声",
    color: "peach",
  },
  {
    id: "Chloe",
    description: "明快清晰",
    language: "英文",
    gender: "女声",
    color: "yellow",
  },
  {
    id: "Milo",
    description: "轻松随和",
    language: "英文",
    gender: "男声",
    color: "blue",
  },
  {
    id: "Dean",
    description: "醇厚成熟",
    language: "英文",
    gender: "男声",
    color: "green",
  },
] as const;

export const voiceConfigSchema = z.object({
  mode: z.enum(voiceModes),
  preset: z.string().max(40),
  description: z.string().max(2000),
  referenceId: z.string().nullable(),
});
export type VoiceConfig = z.infer<typeof voiceConfigSchema>;
export const audioFormats = ["wav", "mp3", "pcm16"] as const;
export type AudioFormat = (typeof audioFormats)[number];

export const draftSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(80),
  text: z.string().max(2000),
  instruction: z.string().max(2000),
  voiceId: z.string().nullable(),
  config: voiceConfigSchema,
  format: z.enum(audioFormats),
  stream: z.boolean(),
  compatibilityStream: z.boolean().optional(),
  optimizeTextPreview: z.boolean().optional(),
});
export type Draft = z.infer<typeof draftSchema> & { updatedAt: number };

export function usesTextPreview(draft: Draft) {
  return draft.config.mode === "design" && draft.optimizeTextPreview === true;
}

export function outputMode(draft: Draft) {
  if (draft.format === "mp3") return "complete";
  if (draft.config.mode === "preset") return draft.stream ? "live" : "complete";
  return draft.compatibilityStream ? "compatible" : "complete";
}
export const saveVoiceSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(40),
  instruction: z.string().max(2000),
  config: voiceConfigSchema,
});
export type Voice = Omit<z.infer<typeof saveVoiceSchema>, "id"> & {
  id: string;
  isDefault: boolean;
  createdAt: number;
};
export type Asset = {
  id: string;
  filename: string;
  format: AudioFormat;
  bytes: number;
  createdAt: number;
};
export type Generation = {
  id: string;
  draftId: string;
  name: string;
  text: string;
  instruction: string;
  config: VoiceConfig;
  voiceName: string;
  format: AudioFormat;
  stream?: boolean;
  compatibilityStream?: boolean;
  optimizeTextPreview?: boolean;
  finalTextPreview?: string;
  status: "generating" | "completed" | "failed";
  assetId: string | null;
  duration: number | null;
  elapsed: number | null;
  favorite: boolean;
  error: string | null;
  createdAt: number;
};
export type StudioState = {
  voices: Voice[];
  drafts: Draft[];
  generations: Generation[];
  assets: Asset[];
  configured: boolean;
  baseUrl: string;
  apiKeyLength: number;
};
export type ApiSettingsState = Pick<
  StudioState,
  "configured" | "baseUrl" | "apiKeyLength"
>;
export const initialConfig: VoiceConfig = {
  mode: "preset",
  preset: "茉莉",
  description: "",
  referenceId: null,
};
export const exampleText =
  "留一点时间，给生活里的小事。\n\n一杯刚好的咖啡，一阵吹过窗边的风，还有此刻，愿意慢下来听听自己的你。\n\n美好的事情，正在发生。";
export const defaultInstruction =
  "自然、温柔，像与朋友分享日常。语速舒缓，句间留一点呼吸感。";
export function modelForMode(mode: VoiceMode) {
  return {
    preset: "mimo-v2.5-tts",
    design: "mimo-v2.5-tts-voicedesign",
    clone: "mimo-v2.5-tts-voiceclone",
  }[mode];
}
export function voiceLabel(config: VoiceConfig) {
  if (config.mode === "design") return "自定义音色";
  if (config.mode === "clone") return "克隆音色";
  return config.preset === "mimo_default" ? "MiMo 默认" : config.preset;
}
export function formatDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
