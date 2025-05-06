"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import ProgressTracker, { ProgressStep } from "@/components/ProgressTracker";
import TranslatedFilesList, {
  TranslatedFile,
} from "@/components/TranslatedFilesList";
import { Button } from "@/components/ui/button";

const TranslationPage = () => {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const { toast } = useToast();

  const [isTranslating, setIsTranslating] = useState(true);
  const [showProgress, setShowProgress] = useState(true);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [translatedFiles, setTranslatedFiles] = useState<TranslatedFile[]>([]);
  const [translationComplete, setTranslationComplete] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("");

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

  const handleDownload = (file: TranslatedFile) => {
    toast({
      title: "Download started",
      description: `Your translated PDF "${file.originalName}" is being downloaded`,
    });

    // Create an anchor element and trigger download
    const link = document.createElement("a");
    link.href = file.translatedUrl;
    link.download = file.translatedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNewTranslation = () => {
    router.push('/');
  };

  useEffect(() => {
    if (!jobId) {
      router.push('/');
      return;
    }

    // Start progress tracking with SSE
    const eventSource = new EventSource(`/api/jobs/${jobId}/progress`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Update progress based on current step
      if (data.progress) {
        const { step, percentage } = data.progress;

        // Set the exact percentage from the server
        setProgressPercentage(percentage);

        // Update the UI based on current step
        if (step === "extract") {
          completeStep("upload", 25);
          updateProgress("extract");
        } else if (step === "translate") {
          completeStep("upload", 25);
          completeStep("extract", 50);
          updateProgress("translate");
        } else if (step === "generate") {
          completeStep("upload", 25);
          completeStep("extract", 50);
          completeStep("translate", 75);
          updateProgress("generate");
        }
      }

      // If job is completed, show results
      if (data.status === "COMPLETED") {
        // Complete all steps
        completeStep("upload", 25);
        completeStep("extract", 50);
        completeStep("translate", 75);
        completeStep("generate", 100);
        setProgressPercentage(100);

        eventSource.close();
        setIsTranslating(false);

        // If there are results, show them
        if (data.results && data.results.length > 0) {
          // Create translated files from the results
          const newTranslatedFiles = data.results.map((result: any) => ({
            id:
              result.id ||
              `file-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 9)}`,
            originalName: result.originalName,
            translatedName: result.translatedName,
            originalUrl: result.originalUrl,
            translatedUrl: result.translatedUrl,
            language: data.language || "unknown",
          }));

          setTranslatedFiles(newTranslatedFiles);
          setTranslationComplete(true);
          setSelectedLanguage(data.language || "unknown");

          toast({
            title: "Translation complete!",
            description: `Your PDFs have been translated successfully`,
          });
        }
      }

      // If job failed, show error
      if (data.status === "FAILED") {
        eventSource.close();
        setIsTranslating(false);
        setShowProgress(false);

        toast({
          variant: "destructive",
          title: "Translation failed",
          description: "Failed to process your files. Please try again.",
        });
        
        // Redirect back to home after a delay
        setTimeout(() => {
          router.push('/');
        }, 3000);
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
      
      // Redirect back to home after a delay
      setTimeout(() => {
        router.push('/');
      }, 3000);
    };

    // Cleanup function
    return () => {
      eventSource.close();
    };
  }, [jobId, router, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              PDF Translation Progress
            </h2>
            <p className="text-xl text-gray-600">
              Your PDFs are being processed and translated
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
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
            <p>Please don't close this page while your PDFs are being translated.</p>
            <p className="mt-1">The process may take a few minutes depending on the size and number of files.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TranslationPage;
