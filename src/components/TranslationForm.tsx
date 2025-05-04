import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

interface TranslationFormProps {
  onLanguageChange: (language: string) => void;
  onTranslate: () => void;
  selectedLanguage: string;
  isFileUploaded: boolean;
}

const languages = [
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "russian", label: "Russian" },
  { value: "chinese", label: "Chinese" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
  { value: "arabic", label: "Arabic" },
  { value: "hindi", label: "Hindi" },
  { value: "dutch", label: "Dutch" },
  { value: "swedish", label: "Swedish" },
  { value: "polish", label: "Polish" },
  { value: "turkish", label: "Turkish" },
  { value: "vietnamese", label: "Vietnamese" },
  { value: "thai", label: "Thai" },
  { value: "indonesian", label: "Indonesian" },
  { value: "greek", label: "Greek" },
];

const TranslationForm: React.FC<TranslationFormProps> = ({
  onLanguageChange,
  onTranslate,
  selectedLanguage,
  isFileUploaded,
}) => {
  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="language-select"
          className="block text-sm font-medium text-gray-700"
        >
          Select target language
        </label>
        <Select value={selectedLanguage} onValueChange={onLanguageChange}>
          <SelectTrigger id="language-select" className="w-full">
            <SelectValue placeholder="Select a language" />
          </SelectTrigger>
          <SelectContent>
            {languages.map((language) => (
              <SelectItem key={language.value} value={language.value}>
                {language.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        className="w-full"
        disabled={!isFileUploaded || !selectedLanguage}
        onClick={onTranslate}
      >
        <Languages className="mr-2 h-4 w-4" />
        Translate PDF
      </Button>

      {!isFileUploaded && (
        <p className="text-sm text-gray-500 text-center">
          Upload a PDF file to continue
        </p>
      )}
    </div>
  );
};

export default TranslationForm;
