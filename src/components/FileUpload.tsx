import React, { useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Cloud, File, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  maxFiles = 5,
  maxFileSize = 5, // 5MB default
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateFiles = (filesToValidate: File[]): File[] => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of filesToValidate) {
      // Check file type
      if (file.type !== "application/pdf") {
        errors.push(`${file.name} is not a PDF file.`);
        continue;
      }

      // Check file size (convert bytes to MB)
      const sizeInMB = file.size / (1024 * 1024);
      if (sizeInMB > maxFileSize) {
        errors.push(`${file.name} exceeds the ${maxFileSize}MB limit.`);
        continue;
      }

      validFiles.push(file);
    }

    // Show errors if any
    if (errors.length > 0) {
      toast({
        variant: "destructive",
        title: "Invalid file(s)",
        description: errors.join("\n"),
      });
    }

    return validFiles;
  };

  const processFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Convert FileList to array
    const filesArray = Array.from(selectedFiles);

    // Limit number of files
    const filesToProcess = filesArray.slice(0, maxFiles - files.length);

    if (filesArray.length > maxFiles - files.length) {
      toast({
        variant: "destructive",
        title: "Too many files",
        description: `You can only upload a maximum of ${maxFiles} files at once.`,
      });
    }

    // Validate files
    const validFiles = validateFiles(filesToProcess);

    if (validFiles.length > 0) {
      const newFiles = [...files, ...validFiles];
      setFiles(newFiles);
      onFileSelect(newFiles);

      toast({
        title: "Files uploaded",
        description: `${validFiles.length} file(s) have been selected.`,
      });
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [files, maxFiles, toast, onFileSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
    },
    [files, maxFiles, toast, onFileSelect]
  );

  const removeFile = (indexToRemove: number) => {
    const newFiles = files.filter((_, index) => index !== indexToRemove);
    setFiles(newFiles);
    onFileSelect(newFiles);
  };

  return (
    <div className="w-full mb-6">
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
        } transition-all duration-200 cursor-pointer`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-3 bg-blue-50 rounded-full">
            <Cloud className="h-10 w-10 text-blue-500" />
          </div>
          <div className="text-lg font-medium">
            {files.length > 0 ? (
              <p className="text-gray-700">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
                <span className="block text-sm text-gray-500 mt-1">
                  Drag more or click to browse (max {maxFiles})
                </span>
              </p>
            ) : (
              <>
                <p className="text-gray-700">
                  Drag and drop your PDF files here
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Upload up to {maxFiles} files (max {maxFileSize}MB each)
                </p>
              </>
            )}
          </div>

          <input
            id="file-upload"
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon className="mr-2 h-4 w-4" />
            Select PDFs
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="font-medium text-gray-700">Selected files:</h3>
          <div className="max-h-40 overflow-y-auto pr-2 space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 p-2 rounded"
              >
                <div className="flex items-center space-x-2">
                  <File className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-700 truncate max-w-xs">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        Supports PDF documents up to {maxFileSize}MB in size.
      </div>
    </div>
  );
};

export default FileUpload;
