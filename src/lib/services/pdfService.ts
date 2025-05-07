import path from "path";
import fs from "fs";
import { writeFile, mkdir, readFile } from "fs/promises";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import { env, validateEnv } from "../env";
import { exec } from "child_process";
import { promisify } from "util";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

interface PdfProcessOptions {
  targetLanguage: string;
  apiKey?: string;
}

/**
 * Service to handle PDF processing, text extraction, translation and generation
 */
export class PdfService {
  private luminaApiKey: string;

  constructor() {
    // Validate environment variables
    validateEnv();
    this.luminaApiKey = env.LUMINA_API_KEY;
  }

  /**
   * Extract text from a PDF file using pdf2htmlEX CLI
   * @param filePath Path to the PDF file
   * @returns HTML-formatted content that preserves original PDF formatting
   */
  async extractTextFromPdf(filePath: string): Promise<string> {
    try {
      const execPromise = promisify(exec);

      // Create a temporary directory for pdf2htmlEX output
      const tempDir = path.join(path.dirname(filePath), "temp_html_output");
      await mkdir(tempDir, { recursive: true });

      // Get the filename without extension
      const fileName = path.basename(filePath, path.extname(filePath));
      const outputHtmlPath = path.join(tempDir, `${fileName}.html`);

      // Execute pdf2htmlEX command with options for better formatting
      // --zoom 1.3: Increase zoom level for better readability
      // --embed cfijo: Embed necessary resources (CSS, fonts, images, JS, outline)
      const command = `pdf2htmlEX --zoom 1.3 ${filePath} --dest-dir ${tempDir}`;

      console.log(`Executing command: ${command}`);
      const { stdout, stderr } = await execPromise(command);

      if (
        stderr &&
        !stderr.includes("Processing") &&
        !stderr.includes("Working")
      ) {
        console.warn("pdf2htmlEX warnings:", stderr);
      }

      // Read the generated HTML file
      const htmlContent = await readFile(outputHtmlPath, "utf-8");

      // Return the HTML content
      return htmlContent;
    } catch (error) {
      throw error;
      console.error("Error extracting HTML from PDF using pdf2htmlEX:", error);

      // Fallback to original PDF parsing method if pdf2htmlEX fails
      try {
        console.log("Falling back to basic PDF text extraction...");
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        const text = data.text;

        // Split text by newlines to create paragraphs
        const paragraphs = text
          .split("\n\n")
          .filter((p: string) => p.trim() !== "");

        // Convert paragraphs to HTML with basic formatting
        let htmlContent = "";

        for (const paragraph of paragraphs) {
          // Check if this might be a heading (short text, possibly all caps)
          const isHeading =
            paragraph.length < 100 &&
            (paragraph.toUpperCase() === paragraph ||
              paragraph.trim().endsWith(":"));

          if (isHeading) {
            htmlContent += `<h2>${paragraph}</h2>\n`;
          } else {
            // Split large paragraphs into smaller ones for better readability
            const lines = paragraph.split("\n");
            for (const line of lines) {
              if (line.trim() !== "") {
                htmlContent += `<p>${line}</p>\n`;
              }
            }
          }
        }

        // Format extracted text into clean HTML
        const formattedHtml = `
          <div class="pdf-content">
            ${htmlContent}
          </div>
        `;

        return formattedHtml;
      } catch (fallbackError) {
        console.error("Fallback extraction also failed:", fallbackError);
        throw new Error(
          `Failed to extract text from PDF: ${error}. Fallback also failed: ${fallbackError}`
        );
      }
    }
  }

  /**
   * Translate HTML content to target language
   * @param htmlContent HTML content to translate
   * @param targetLanguage Target language code
   * @returns Translated HTML content
   */
  async translateHtml(
    htmlContent: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      // Use OpenAI to translate while preserving HTML format
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the HTML content to ${targetLanguage}. 
                     Preserve all HTML tags and structure. Only translate the text content between tags.`,
          },
          {
            role: "user",
            content: htmlContent,
          },
        ],
        temperature: 0.3,
      });

      return completion.choices[0].message.content || htmlContent;
    } catch (error) {
      console.error("Translation error:", error);
      throw new Error(`Failed to translate content: ${error}`);
    }
  }

  /**
   * Generate PDF from HTML content using Lumina PDF API
   * @param htmlContent HTML content to convert to PDF
   * @param outputPath Path to save the generated PDF
   * @returns Path to the generated PDF file
   */
  async generatePdfFromHtml(
    htmlContent: string,
    outputPath: string
  ): Promise<string> {
    try {
      // Ensure the directory exists
      const dir = path.dirname(outputPath);
      await mkdir(dir, { recursive: true });

      // Call Lumina PDF API
      const response = await fetch(
        "https://api-staging.luminapdf.xyz/api/v1/generate/pdf",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.luminaApiKey}`,
          },
          body: JSON.stringify({
            source: htmlContent,
            format: "A4",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `PDF generation failed with status: ${response.status}`
        );
      }

      // Get the PDF file as a blob and save it
      const pdfBlob = await response.blob();
      const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
      await writeFile(outputPath, pdfBuffer);

      return outputPath;
    } catch (error) {
      console.error("PDF generation error:", error);
      throw new Error(`Failed to generate PDF: ${error}`);
    }
  }

  /**
   * Process a PDF file: extract text, translate, and generate new PDF
   * @param inputPath Path to the input PDF file
   * @param outputDir Directory to save the translated PDF
   * @param options Processing options
   * @returns Path to the translated PDF file
   */
  async processPdf(
    inputPath: string,
    outputDir: string,
    options: PdfProcessOptions
  ): Promise<string> {
    try {
      // Extract text as HTML
      const htmlContent = await this.extractTextFromPdf(inputPath);

      // Translate the HTML content
      const translatedHtml = await this.translateHtml(
        htmlContent,
        options.targetLanguage
      );

      // Generate the translated PDF
      const fileName = path.basename(inputPath);
      const outputPath = path.join(outputDir, `translated_${fileName}`);

      // If custom API key provided, use it
      if (options.apiKey) {
        this.luminaApiKey = options.apiKey;
      }

      // Generate the PDF file
      await this.generatePdfFromHtml(translatedHtml, outputPath);

      return outputPath;
    } catch (error) {
      console.error("PDF processing error:", error);
      throw new Error(`Failed to process PDF: ${error}`);
    }
  }
}
