import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { mkdir, writeFile } from "fs/promises";
import { PdfService } from "@/lib/services/pdfService";
import { JobService } from "@/lib/services/jobService";
import { env, validateEnv } from "@/lib/env";

// Type definitions for Prisma enums
type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
type ProcessStep = "UPLOAD" | "EXTRACT" | "TRANSLATE" | "GENERATE";

// Initialize the uploads directory
initialization();

async function initialization() {
  // Validate environment variables
  validateEnv();

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "uploads");

  try {
    if (!fs.existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
      console.log("Created uploads directory:", uploadsDir);
    }
  } catch (error) {
    console.error("Failed to create uploads directory:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const language = formData.get("language") as string;

    if (!language) {
      return NextResponse.json(
        { error: "Target language is required" },
        { status: 400 }
      );
    }

    const uploadedFiles = formData.getAll("files") as File[];

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: "At least one file is required" },
        { status: 400 }
      );
    }

    if (uploadedFiles.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 files allowed" },
        { status: 400 }
      );
    }

    // Create a new job in the database
    const jobService = new JobService();
    const job = await jobService.createJob(language);
    const jobId = job.id;

    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), "uploads", jobId);
    await mkdir(uploadDir, { recursive: true });

    // Save files to disk and record in database
    for (const file of uploadedFiles) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        return NextResponse.json(
          { error: `File ${file.name} exceeds 5MB limit` },
          { status: 400 }
        );
      }

      if (file.type !== "application/pdf") {
        return NextResponse.json(
          { error: `File ${file.name} is not a PDF` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(uploadDir, file.name);
      await writeFile(filePath, buffer);

      // Add file to job in database
      await jobService.addFile(jobId, file.name, filePath);
    }

    // Update job status to processing and set step to UPLOAD
    await jobService.updateJobProgress(
      jobId,
      "PROCESSING" as JobStatus,
      "UPLOAD" as ProcessStep,
      25
    );

    // Start processing in the background without waiting for it to complete
    processJob(jobId);

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}

// Function to process the job asynchronously
async function processJob(jobId: string) {
  try {
    // Initialize services
    const pdfService = new PdfService();
    const jobService = new JobService();

    // Get job from database
    const job = await jobService.getJob(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }

    // Create directories for translated files
    const translatedDir = path.join(
      process.cwd(),
      "uploads",
      jobId,
      "translated"
    );
    await mkdir(translatedDir, { recursive: true });

    // Add a small delay to ensure the client sees the upload step
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update to extraction step
    await jobService.updateJobProgress(
      jobId,
      "PROCESSING" as JobStatus,
      "EXTRACT" as ProcessStep,
      50
    );

    // Add a small delay to ensure the client sees the extraction step
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Process extraction in the background
    setTimeout(async () => {
      await extractAndTranslate(jobId, pdfService, jobService);
    }, 0);
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    const jobService = new JobService();
    await jobService.updateJobProgress(
      jobId,
      "FAILED" as JobStatus,
      "UPLOAD" as ProcessStep,
      0
    );
  }
}

// Functions for subsequent steps will be called by each previous step
async function extractAndTranslate(
  jobId: string,
  pdfService: PdfService,
  jobService: JobService
) {
  try {
    // Get job from database
    const job = await jobService.getJob(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }

    // Extract text from PDFs and translate
    const extractedContents: {
      fileId: string;
      filePath: string;
      htmlContent: string;
    }[] = [];

    // Process each PDF file
    for (const file of job.files) {
      try {
        console.log(`Extracting text from ${file.originalPath}`);
        // Extract text as HTML
        const htmlContent = await pdfService.convertPdfToHtml(
          file.originalPath
        );
        extractedContents.push({
          fileId: file.id,
          filePath: file.originalPath,
          htmlContent,
        });
      } catch (extractError) {
        console.error(
          `Error extracting from ${file.originalPath}:`,
          extractError
        );
      }
    }

    // Update to translation step
    await jobService.updateJobProgress(
      jobId,
      "PROCESSING" as JobStatus,
      "TRANSLATE" as ProcessStep,
      75
    );

    // Add a small delay to ensure the client sees the translation step
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Process translation in the background
    setTimeout(async () => {
      await generateFinalPdfs(jobId, pdfService, jobService, extractedContents);
    }, 0);
  } catch (error) {
    console.error(`Error extracting and translating for job ${jobId}:`, error);
    const jobService = new JobService();
    await jobService.updateJobProgress(
      jobId,
      "FAILED" as JobStatus,
      "EXTRACT" as ProcessStep,
      50
    );
  }
}

async function generateFinalPdfs(
  jobId: string,
  pdfService: PdfService,
  jobService: JobService,
  extractedContents: { fileId: string; filePath: string; htmlContent: string }[]
) {
  try {
    // Get job from database
    const job = await jobService.getJob(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }

    // Update to generate step
    await jobService.updateJobProgress(
      jobId,
      "PROCESSING" as JobStatus,
      "GENERATE" as ProcessStep,
      100
    );

    const translatedDir = path.join(
      process.cwd(),
      "uploads",
      jobId,
      "translated"
    );

    // Process each extracted content
    for (const { fileId, filePath, htmlContent } of extractedContents) {
      try {
        // Get the filename
        const fileName = path.basename(filePath);

        // Translate the HTML content
        console.log(`Translating content from ${fileName} to ${job.language}`);
        const translatedHtml = await pdfService.translateHtml(
          htmlContent,
          job.language
        );

        // Define output path for the translated PDF
        const translatedName = `translated_${fileName}`;
        const outputPath = path.join(translatedDir, translatedName);

        // Generate the translated PDF
        console.log(`Generating translated PDF to ${outputPath}`);
        await pdfService.generatePdfFromHtml(translatedHtml, outputPath);

        // Update file in database with translated file info
        await jobService.updateFileWithTranslation(
          fileId,
          translatedName,
          outputPath
        );
      } catch (translationError) {
        console.error(`Error processing file ${filePath}:`, translationError);
      }
    }

    // Add a small delay to ensure the client sees the generation step
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update to complete step
    await jobService.updateJobProgress(
      jobId,
      "COMPLETED" as JobStatus,
      "GENERATE" as ProcessStep,
      100
    );
  } catch (error) {
    console.error(`Error generating PDFs for job ${jobId}:`, error);
    const jobService = new JobService();
    await jobService.updateJobProgress(
      jobId,
      "FAILED" as JobStatus,
      "TRANSLATE" as ProcessStep,
      75
    );
  }
}
