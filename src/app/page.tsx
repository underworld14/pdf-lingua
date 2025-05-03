"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/FileUpload";
import TranslationForm from "@/components/TranslationForm";
import Header from "@/components/Header";
import ProgressTracker, { ProgressStep } from "@/components/ProgressTracker";
import TranslatedFilesList, {
  TranslatedFile,
} from "@/components/TranslatedFilesList";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [translatedFiles, setTranslatedFiles] = useState<TranslatedFile[]>([]);
  const [translationComplete, setTranslationComplete] = useState(false);
  const { toast } = useToast();

  const initialSteps: ProgressStep[] = [
    {
      id: "upload",
      label: "Uploading PDFs to Server",
      completed: false,
      current: false,
    },
    {
      id: "extract",
      label: "Extracting contents",
      completed: false,
      current: false,
    },
    {
      id: "translate",
      label: "Translating PDFs",
      completed: false,
      current: false,
    },
    {
      id: "generate",
      label: "Successfully Generated PDFs",
      completed: false,
      current: false,
    },
  ];

  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps);

  const updateProgress = (stepId: string) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) => {
        // Mark previous steps as completed
        if (step.id === stepId) {
          return { ...step, current: true };
        } else if (step.current) {
          return { ...step, current: false, completed: true };
        }
        return step;
      })
    );
  };

  const completeStep = (stepId: string, percentage: number) => {
    setProgressPercentage(percentage);
    setSteps((prevSteps) =>
      prevSteps.map((step) =>
        step.id === stepId ? { ...step, completed: true, current: false } : step
      )
    );
  };

  const handleFileSelect = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    // Reset states when new files are uploaded
    setShowProgress(false);
    setProgressPercentage(0);
    setSteps(initialSteps);
    setTranslatedFiles([]);
    setTranslationComplete(false);
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleDownload = (file: TranslatedFile) => {
    toast({
      title: "Download started",
      description: `Your translated PDF "${file.originalName}" is being downloaded`,
    });
    
    // Create an anchor element and trigger download
    const link = document.createElement('a');
    link.href = file.translatedUrl;
    link.download = file.translatedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    setIsTranslating(true);
    setShowProgress(true);
    
    try {
      // Immediately show upload in progress
      updateProgress('upload');
      setProgressPercentage(25);
      
      // Create form data for upload
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('language', selectedLanguage);
      
      // Upload files and get job ID
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const { jobId } = await response.json();
      
      // Mark upload as completed immediately after successful API response
      completeStep('upload', 25);
      updateProgress('extract');
      setProgressPercentage(50);
      
      // Start progress tracking with SSE
      const eventSource = new EventSource(`/api/jobs/${jobId}/progress`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('SSE update:', data);
        
        // Update progress based on current step
        if (data.progress) {
          const { step, percentage } = data.progress;
          
          // Set the exact percentage from the server
          setProgressPercentage(percentage);
          
          // Update the UI based on current step
          if (step === 'extract') {
            completeStep('upload', 25);
            updateProgress('extract');
          } else if (step === 'translate') {
            completeStep('upload', 25);
            completeStep('extract', 50);
            updateProgress('translate');
          } else if (step === 'generate') {
            completeStep('upload', 25);
            completeStep('extract', 50);
            completeStep('translate', 75);
            updateProgress('generate');
          }
        }
        
        // If job is completed, show results
        if (data.status === 'COMPLETED') {
          // Complete all steps
          completeStep('upload', 25);
          completeStep('extract', 50);
          completeStep('translate', 75);
          completeStep('generate', 100);
          setProgressPercentage(100);
          
          eventSource.close();
          setIsTranslating(false);
          
          // If there are results, show them
          if (data.results && data.results.length > 0) {
            // Create translated files from the results
            const newTranslatedFiles = data.results.map((result: any) => ({
              id: result.id || `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              originalName: result.originalName,
              translatedName: result.translatedName,
              originalUrl: result.originalUrl,
              translatedUrl: result.translatedUrl,
              language: selectedLanguage,
            }));

            setTranslatedFiles(newTranslatedFiles);
            setTranslationComplete(true);

            // Get language label for display
            const languageLabel =
              languages.find((lang) => lang.value === selectedLanguage)?.label ||
              selectedLanguage;

            toast({
              title: "Translation complete!",
              description: `${files.length} PDF(s) have been translated to ${languageLabel}`,
            });
          }
          }
          
          // If job failed, show error
          if (data.status === 'failed') {
            eventSource.close();
            setIsTranslating(false);
            setShowProgress(false);
            
            toast({
              variant: "destructive",
              title: "Translation failed",
              description: "Failed to process your files. Please try again.",
            });
          }
        };
        
        eventSource.onerror = () => {
          eventSource.close();
          setIsTranslating(false);
          setShowProgress(false);
          
          toast({
            variant: "destructive",
            title: "Connection error",
            description: "Lost connection to the server. Please try again.",
          });
        };
      
    } catch (error) {
      setIsTranslating(false);
      setShowProgress(false);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start translation",
      });
    }
  };

  const handleNewTranslation = () => {
    // Reset all states to initial values
    setFiles([]);
    setSelectedLanguage("");
    setShowProgress(false);
    setProgressPercentage(0);
    setSteps(initialSteps);
    setTranslationComplete(false);
  };

  const languages = [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "it", label: "Italian" },
    { value: "pt", label: "Portuguese" },
    { value: "ru", label: "Russian" },
    { value: "zh", label: "Chinese" },
    { value: "ja", label: "Japanese" },
    { value: "ko", label: "Korean" },
    { value: "ar", label: "Arabic" },
    { value: "hi", label: "Hindi" },
  ];

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
            {!showProgress && !translationComplete && (
              <>
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
                />
              </>
            )}

            <ProgressTracker
              steps={steps}
              visible={showProgress && !translationComplete}
              progressPercentage={progressPercentage}
              onDownload={() => {}} // Not used for individual files anymore
              translatedUrl={
                translatedFiles.length > 0
                  ? translatedFiles[0].translatedUrl
                  : undefined
              }
            />

            {translationComplete && (
              <div className="space-y-6">
                <TranslatedFilesList
                  files={translatedFiles}
                  onDownload={handleDownload}
                />

                <div className="border-t border-gray-100 pt-6 mt-8">
                  <Button
                    onClick={handleNewTranslation}
                    variant="outline"
                    className="w-full"
                  >
                    Translate More PDFs
                  </Button>
                </div>
              </div>
            )}

            {isTranslating && !showProgress && (
              <div className="mt-6 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-2 text-gray-600">
                  Translating your documents...
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
