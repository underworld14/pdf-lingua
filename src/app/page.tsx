"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/FileUpload";
import TranslationForm from "@/components/TranslationForm";
import Header from "@/components/Header";

const Index = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleFileSelect = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleTranslate = async () => {
    if (files.length === 0 || !selectedLanguage) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description:
          "Please upload at least one PDF file and select a language.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create form data for upload
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("language", selectedLanguage);

      // Upload files and get job ID
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const { jobId } = await response.json();

      // Redirect to the translation progress page
      router.push(`/translate/${jobId}`);
    } catch (error) {
      setIsSubmitting(false);

      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to start translation",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Translate PDFs with AI
            </h2>
            <p className="text-xl text-gray-600">
              Upload your PDFs and instantly translate them to any language
              using advanced AI.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <FileUpload
              onFileSelect={handleFileSelect}
              maxFiles={5}
              maxFileSize={5}
            />

            <div className="w-full border-t border-gray-200 my-6"></div>

            <TranslationForm
              onLanguageChange={handleLanguageChange}
              onTranslate={handleTranslate}
              selectedLanguage={selectedLanguage}
              isFileUploaded={files.length > 0}
              isSubmitting={isSubmitting}
            />

            {isSubmitting && (
              <div className="mt-6 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-2 text-gray-600">
                  Uploading your documents...
                </p>
              </div>
            )}
          </div>

          <div className="text-center text-gray-500 text-sm">
            <p>Supports PDF documents up to 5MB in size.</p>
            <p className="mt-1">Instant translations for over 100 languages.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
