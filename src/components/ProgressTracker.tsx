
import React from 'react';
import { Check, Download } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ProgressStep = {
  id: string;
  label: string;
  completed: boolean;
  current: boolean;
};

interface ProgressTrackerProps {
  steps: ProgressStep[];
  visible: boolean;
  progressPercentage: number;
  onDownload?: () => void;
  translatedUrl?: string;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ 
  steps, 
  visible, 
  progressPercentage, 
  onDownload,
  translatedUrl 
}) => {
  if (!visible) return null;
  
  const allCompleted = steps.every(step => step.completed);

  return (
    <div className="mt-8 w-full space-y-6 transition-all animate-fade-in">
      <div className="mb-2">
        <Progress value={progressPercentage} className="h-2" />
        <div className="mt-1 text-right text-xs text-gray-500">
          {progressPercentage}%
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <div 
            key={step.id}
            className={cn(
              "flex items-center p-3 rounded-md transition-colors",
              step.current && !step.completed ? "bg-blue-50" : "bg-transparent",
              step.completed ? "text-gray-700" : "text-gray-500"
            )}
          >
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center mr-3",
              step.completed ? "bg-green-500" : "bg-gray-200"
            )}>
              {step.completed ? (
                <Check className="h-4 w-4 text-white" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-white"></span>
              )}
            </div>
            <span className={cn(
              "text-sm",
              step.completed ? "font-medium" : "font-normal"
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {allCompleted && translatedUrl && (
        <div className="pt-4 border-t border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-medium text-gray-900">Translation Complete</h3>
              <p className="text-sm text-gray-500">Your translated document is ready</p>
            </div>
            <Button onClick={onDownload} className="bg-green-500 hover:bg-green-600">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;
