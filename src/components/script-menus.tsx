"use client";

import { ChevronDown, FileText, Music2, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { inlineTags, styleTags, ttsExampleGroups, type TtsExample } from "@/lib/tts-examples";

export function ScriptMenus({
  singingAvailable,
  onSing,
  onStyle,
  onInlineTag,
  onExample,
}: {
  singingAvailable: boolean;
  onSing: () => void;
  onStyle: (tag: string) => void;
  onInlineTag: (tag: string) => void;
  onExample: (example: TtsExample) => void;
}) {
  return (
    <div className="tag-tools">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Smile data-icon="inline-start" />
            插入标签
            <ChevronDown data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="script-menu">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onSing} disabled={!singingAvailable}>
              <Music2 />
              唱歌（预置音色）
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {styleTags.map(({ label, tags }) => (
            <DropdownMenuGroup key={label}>
              <DropdownMenuLabel>整段 · {label}</DropdownMenuLabel>
              {tags.map((tag) => (
                <DropdownMenuItem key={tag} onSelect={() => onStyle(tag)}>
                  {tag}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
          {inlineTags.map(({ label, tags }) => (
            <DropdownMenuGroup key={label}>
              <DropdownMenuLabel>局部 · {label}</DropdownMenuLabel>
              {tags.map((tag) => (
                <DropdownMenuItem key={tag} onSelect={() => onInlineTag(tag)}>
                  {tag}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator orientation="vertical" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" title="选择案例并创建草稿">
            <FileText data-icon="inline-start" />
            示例案例
            <ChevronDown data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="script-menu">
          {ttsExampleGroups.map(({ label, examples }) => (
            <DropdownMenuGroup key={label}>
              <DropdownMenuLabel>{label}</DropdownMenuLabel>
              {examples.map((example) => (
                <DropdownMenuItem key={example.title} onSelect={() => onExample(example)}>
                  {example.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
