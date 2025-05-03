
import React from 'react';
import { Download, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface TranslatedFile {
  id: string;
  originalName: string;
  translatedUrl: string;
  language: string;
}

interface TranslatedFilesListProps {
  files: TranslatedFile[];
  onDownload: (file: TranslatedFile) => void;
}

const TranslatedFilesList: React.FC<TranslatedFilesListProps> = ({
  files,
  onDownload
}) => {
  if (files.length === 0) return null;
  
  return (
    <div className="mt-8 space-y-6 animate-fade-in">
      <h3 className="text-xl font-medium text-gray-800">Translated Documents</h3>
      
      <div className="space-y-4">
        {files.map((file) => (
          <Card key={file.id} className="overflow-hidden border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 rounded">
                    <File className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 mb-1">{file.originalName}</h4>
                    <p className="text-sm text-gray-500">Translated to {file.language}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => onDownload(file)} 
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TranslatedFilesList;
