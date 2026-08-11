import { useRef } from "react";
import { Camera } from "lucide-react";
import { useT } from "@/shared/lib/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";

interface AvatarPickerProps {
  value?: string;
  fallback: string;
  fallbackColor?: string;
  onChange: (dataUri: string) => void;
  disabled?: boolean;
}

const MAX_BYTES = 2_000_000;

/**
 * Click-to-upload circular avatar. Reads the chosen file as a base64 data URI
 * so it can be stored directly in the database (users and roles both support
 * an `avatarUrl` column) — no separate file storage needed.
 */
export function AvatarPicker({ value, fallback, fallbackColor, onChange, disabled }: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert(t("Please choose an image file.", "يرجى اختيار ملف صورة."));
      return;
    }
    if (file.size > MAX_BYTES) {
      alert(t("Image must be under 2 MB.", "يجب أن يكون حجم الصورة أقل من 2 ميجابايت."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = typeof reader.result === "string" ? reader.result : "";
      if (dataUri) onChange(dataUri);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {value ? <AvatarImage src={value} alt={fallback} /> : null}
        <AvatarFallback style={fallbackColor ? { backgroundColor: fallbackColor } : undefined}>
          {fallback}
        </AvatarFallback>
      </Avatar>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-start gap-1">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <Camera className="size-4" /> {value ? t("Change photo", "تغيير الصورة") : t("Upload photo", "رفع صورة")}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange("")}>
            {t("Remove", "إزالة")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
