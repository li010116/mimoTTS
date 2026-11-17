import { z } from "zod";

export const voiceModes = ["preset", "design", "clone"] as const;
export type VoiceMode = (typeof voiceModes)[number];
export const presetVoices = [
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
export const draftSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(80),
  text: z.string().max(2000),
  instruction: z.string().max(2000),
  voiceId: z.string().nullable(),
  config: voiceConfigSchema,
  format: z.enum(["wav", "mp3"]),
  stream: z.boolean(),
});
export type Draft = z.infer<typeof draftSchema> & { updatedAt: number };
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
  format: "wav" | "mp3";
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
  format: "wav" | "mp3";
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
};
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
  return config.preset;
}
export function formatDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
