"use client";

import { File, Paperclip, X } from "lucide-react";

import { formatBytes } from "@/lib/constants";
import type { InputFile } from "@/types/blackbox";

type DraftFile = Pick<InputFile, "name" | "type" | "size">;

export function FileDropzone({
  files,
  onChange,
}: {
  files: DraftFile[];
  onChange: (files: DraftFile[]) => void;
}) {
  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-cyan/25 bg-cyan/[0.035] px-4 py-7 text-center transition hover:bg-cyan/[0.065]">
        <Paperclip className="h-5 w-5 text-cyan" />
        <span className="mt-2 text-sm font-semibold text-slate-200">Attach input evidence</span>
        <span className="mt-1 text-xs text-slate-500">
          Attach files, screenshots, PDFs, or notes that support this task. Agent BlackBox records their metadata and includes them in the sealed proof trail.
        </span>
        <input
          className="hidden"
          type="file"
          multiple
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []).map((file) => ({
              name: file.name,
              type: file.type || "application/octet-stream",
              size: file.size,
            }));
            onChange([...files, ...selected]);
            event.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, index) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2"
              key={`${file.name}-${index}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <File className="h-4 w-4 shrink-0 text-cyan" />
                <p className="truncate text-xs text-slate-300">{file.name}</p>
                <span className="shrink-0 text-[0.68rem] text-slate-600">{formatBytes(file.size)}</span>
              </div>
              <button
                type="button"
                className="text-slate-600 transition hover:text-rose-200"
                onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
