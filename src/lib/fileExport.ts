type SaveFileType = {
  description: string;
  accept: Record<string, string[]>;
};

type SaveBlobOptions = {
  fallbackMimeType?: string;
  fileType?: SaveFileType;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: SaveFileType[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

export async function saveBlobWithPicker(
  blob: Blob,
  filename: string,
  options: SaveBlobOptions = {}
): Promise<void> {
  const pickerWindow = window as SaveFilePickerWindow;

  if (pickerWindow.showSaveFilePicker) {
    try {
      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: filename,
        types: options.fileType ? [options.fileType] : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error; // User cancelled
      }
      // Fall through to fallback method
    }
  }

  // Fallback for browsers without File System Access API
  const downloadableBlob =
    options.fallbackMimeType && blob.type !== options.fallbackMimeType
      ? new Blob([blob], { type: options.fallbackMimeType })
      : blob;

  const url = URL.createObjectURL(downloadableBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function createCsvBlob(lines: string[]): Blob {
  return new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
}

export function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export const exportPdfType = {
  description: "PDF document",
  accept: { "application/pdf": [".pdf"] },
};

export const exportCsvType = {
  description: "CSV spreadsheet",
  accept: { "text/csv": [".csv"] },
};
