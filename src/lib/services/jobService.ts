import { prisma } from '@/lib/prisma';
import type { Job, File, Prisma } from '@/generated/prisma';

// Prisma enums
type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type ProcessStep = 'UPLOAD' | 'EXTRACT' | 'TRANSLATE' | 'GENERATE';
import path from 'path';

/**
 * Service to handle translation job management
 */
export class JobService {
  /**
   * Create a new translation job
   * @param language Target language code
   * @returns The created job
   */
  async createJob(language: string): Promise<Job> {
    return prisma.job.create({
      data: {
        language,
        status: 'QUEUED',
        currentStep: 'UPLOAD',
        percentage: 0
      }
    });
  }

  /**
   * Get a job by ID
   * @param id Job ID
   * @returns The job or null if not found
   */
  async getJob(id: string): Promise<(Job & { files: File[] }) | null> {
    return prisma.job.findUnique({
      where: { id },
      include: { files: true }
    });
  }

  /**
   * Add a file to a job
   * @param jobId Job ID
   * @param fileName Original file name
   * @param filePath Path to the saved file
   * @returns The created file
   */
  async addFile(jobId: string, fileName: string, filePath: string): Promise<File> {
    return prisma.file.create({
      data: {
        jobId,
        originalName: fileName,
        originalPath: filePath
      }
    });
  }

  /**
   * Update file with translated file info
   * @param fileId File ID
   * @param translatedName Translated file name
   * @param translatedPath Path to the translated file
   * @returns The updated file
   */
  async updateFileWithTranslation(
    fileId: string,
    translatedName: string,
    translatedPath: string
  ): Promise<File> {
    return prisma.file.update({
      where: { id: fileId },
      data: {
        translatedName,
        translatedPath
      }
    });
  }

  /**
   * Update job status and progress
   * @param jobId Job ID
   * @param status New job status
   * @param step Current process step
   * @param percentage Completion percentage
   * @returns The updated job
   */
  async updateJobProgress(
    jobId: string,
    status: JobStatus,
    step: ProcessStep,
    percentage: number
  ): Promise<Job> {
    return prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        currentStep: step,
        percentage
      }
    });
  }

  /**
   * Get all files for a job
   * @param jobId Job ID
   * @returns Array of files
   */
  async getJobFiles(jobId: string): Promise<File[]> {
    return prisma.file.findMany({
      where: { jobId }
    });
  }

  /**
   * Format job data for client response
   * @param job Job with files
   * @returns Formatted job data for client
   */
  formatJobResponse(job: Job & { files: File[] }) {
    return {
      id: job.id,
      status: job.status,
      language: job.language,
      progress: {
        step: job.currentStep?.toLowerCase() || 'upload',
        percentage: job.percentage
      },
      results: job.files
        .filter(file => file.translatedName && file.translatedPath)
        .map(file => ({
          id: file.id,
          originalName: file.originalName,
          translatedName: file.translatedName || '',
          originalUrl: `/api/files/${job.id}/original/${encodeURIComponent(file.originalName)}`,
          translatedUrl: `/api/files/${job.id}/translated/${encodeURIComponent(file.translatedName || '')}`
        }))
    };
  }
}
