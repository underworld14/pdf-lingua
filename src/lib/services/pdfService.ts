import path from "path";
import { writeFile, mkdir, readFile } from "fs/promises";
import OpenAI from "openai";
import { env, validateEnv } from "../env";
import { exec } from "child_process";
import { promisify } from "util";
import * as cheerio from "cheerio";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

interface PdfProcessOptions {
  targetLanguage: string;
  apiKey?: string;
}

interface TextChunk {
  id: string;
  text: string;
  context?: string; // Store context for better translations
}

interface ElementMapping {
  element: any; // Using any for Cheerio element type to avoid type errors
  html: string | null;
  parentText?: string; // Store parent context for better translations
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
  async convertPdfToHtml(filePath: string): Promise<string> {
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
      const command = [
        "pdf2htmlEX",
        "--zoom 1.3",
        // "--embed-css 0",
        // "--embed-image 0",
        // "--embed-font 0",
        // "--embed-javascript 0",
        // "--embed-outline 0",
        "--process-form 0",
        "--optimize-text 1",
        `'${filePath}'`,
        "--dest-dir",
        tempDir,
      ].join(" ");

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
      throw new Error(`Failed to extract text from PDF: ${error}`);
    }
  }

  /**
   * Translate HTML content to target language using chunking for efficiency
   * @param htmlContent HTML content to translate
   * @param targetLanguage Target language code
   * @returns Translated HTML content
   */
  async translateHtml(
    htmlContent: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      console.log(
        "🚀 Starting translation process with token-efficient approach"
      );

      // Load HTML content with cheerio
      const $ = cheerio.load(htmlContent);

      console.log("📄 Extracting text content from HTML...");

      // Step 1: Identify parent containers that contain complete semantic units
      const parentElements: any[] = [];

      // First find all parent containers (.t elements)
      $("#page-container .t").each((_, element) => {
        parentElements.push(element);
      });

      console.log(`Found ${parentElements.length} parent elements to process`);

      // Step 2: Process each parent container to extract text and structure
      const contentMap = new Map<string, ElementMapping>();
      const textChunks: TextChunk[] = [];

      parentElements.forEach((parentElement, parentIndex) => {
        const $parent = $(parentElement);
        const fullText = $parent.text().trim();

        // Skip empty elements
        if (!fullText) return;

        // Create unique identifier for this parent element
        const elementId = `elem_${parentIndex}`;

        // Store complete information about this element, including its HTML structure
        contentMap.set(elementId, {
          element: parentElement,
          html: $parent.html(),
          parentText: fullText,
        });

        // Add to chunks for translation with context
        textChunks.push({
          id: elementId,
          text: fullText,
          context: $parent.closest(".pf").attr("data-page-no"), // Include page number as context
        });
      });

      console.log(
        `📊 Extracted ${textChunks.length} text chunks for translation`
      );

      // Group chunks into logical batches for translation
      const batches: TextChunk[][] = [];
      let currentBatch: TextChunk[] = [];
      let currentBatchSize = 0;
      const MAX_BATCH_SIZE = 4000; // Characters, not tokens - more efficient

      for (const chunk of textChunks) {
        if (
          currentBatchSize + chunk.text.length > MAX_BATCH_SIZE &&
          currentBatch.length > 0
        ) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBatchSize = 0;
        }

        currentBatch.push(chunk);
        currentBatchSize += chunk.text.length;
      }

      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }

      console.log(`📦 Created ${batches.length} batches for translation`);

      // Process all batches in parallel
      console.log(
        `🔄 Starting parallel translation of ${batches.length} batches...`
      );

      // Function to process a single batch
      async function processBatch(
        batch: TextChunk[],
        batchIndex: number,
        targetLang: string
      ): Promise<TextChunk[]> {
        if (!batch || batch.length === 0) return []; // Skip empty batches

        console.log(`🕐 Starting batch ${batchIndex + 1}/${batches.length}`);

        try {
          // Prepare batch for translation - send ONLY TEXT, not HTML
          const batchForTranslation = batch.map((item) => ({
            id: item.id,
            text: item.text,
            context: item.context,
          }));

          const resp = await openai.chat.completions.create({
            model: "gpt-4.1-nano",
            messages: [
              {
                role: "system",
                content: `You are a professional and accurate International Translator who translates from English to ${targetLang}.
                
                You will receive a JSON array with items containing:
                - id: A unique identifier (do NOT change this)
                - text: The text to translate (translate this from English to ${targetLang})
                - context: Additional context such as the page number (do NOT translate this field)
                
                IMPORTANT TRANSLATION GUIDELINES:
                1. Maintain all formatting, spacing, and punctuation exactly as in the original.
                2. For split words or phrases, ensure they remain properly split in the translation.
                3. Do not translate proper nouns (names, companies, brands, technical terms).
                4. If text appears to be a fragment or part of a larger phrase, translate it appropriately considering its likely context.
                5. Return a JSON array with the EXACT same structure as the input.
                6. Analyze text carefully to understand if it's a complete sentence or fragment before translating.
                `,
              },
              { role: "user", content: JSON.stringify(batchForTranslation) },
            ],
          });

          // Process the response
          const content = resp?.choices?.[0]?.message?.content;

          if (content) {
            try {
              const translatedItems = JSON.parse(content) as TextChunk[];
              console.log(`✅ Successfully translated batch ${batchIndex + 1}`);
              return translatedItems;
            } catch (err) {
              console.warn(
                `⚠️ Failed to parse API response for batch ${batchIndex + 1}:`,
                err
              );
              return [];
            }
          } else {
            console.warn(
              `⚠️ Received empty response from API for batch ${batchIndex + 1}`
            );
            return [];
          }
        } catch (error) {
          console.error(`❌ Error translating batch ${batchIndex + 1}:`, error);
          return [];
        }
      }

      // Create an array of promises for all batches
      const batchPromises = batches.map((batch, index) =>
        processBatch(batch, index, targetLanguage)
      );

      // Wait for all translations to complete in parallel
      const translatedBatches = await Promise.all(batchPromises);
      console.log(
        `💯 All ${translatedBatches.length} batches processed in parallel`
      );

      // Apply all translations to the HTML
      console.log(`🛠 Applying translations to HTML...`);
      let appliedTranslations = 0;

      translatedBatches.forEach((translatedItems) => {
        for (const translatedItem of translatedItems) {
          const { id, text } = translatedItem;
          const original = contentMap.get(id);

          if (original && original.element) {
            // Carefully replace the text content while maintaining the HTML structure
            const $element = $(original.element);
            const originalHtml = original.html;

            if (!originalHtml) continue;

            // Function to rebuild the HTML with translated text
            const rebuiltHtml = this.replaceTextWhilePreservingTags(
              originalHtml,
              original.parentText || "",
              text
            );

            // Apply the reconstructed HTML
            $element.html(rebuiltHtml);
            appliedTranslations++;
          }
        }
      });

      console.log(
        `✨ Applied ${appliedTranslations} translations to HTML elements`
      );

      // Return the translated HTML
      return $.html();
    } catch (error) {
      console.error("Translation error:", error);
      throw new Error(`Failed to translate content: ${error}`);
    }
  }

  /**
   * Special function to replace text content while preserving all HTML tags and structure
   * This handles the complex split text spans in pdf2htmlEX output
   */
  private replaceTextWhilePreservingTags(
    html: string,
    originalText: string,
    translatedText: string
  ): string {
    // If source and translated text are identical, no need to do anything
    if (originalText === translatedText) return html;

    // Sanitize translatedText to remove any 'undefined' strings that might have been injected
    translatedText = translatedText.replace(/undefined/g, "");

    // Create a cheerio instance for manipulation
    const $ = cheerio.load(`<div>${html}</div>`);
    const $root = $("div").first();

    // Extract all text nodes and their positions
    const textNodes: {
      node: any;
      text: string;
      isTextNode: boolean;
      parent: any;
    }[] = [];

    // Function to collect all text and elements in order
    function collectNodes(element: any) {
      $(element)
        .contents()
        .each((_, node) => {
          // Check if it's a text node
          if (node.type === "text") {
            const text = $(node).text();
            if (text.trim()) {
              textNodes.push({ node, text, isTextNode: true, parent: element });
            }
          } else if (node.type === "tag") {
            // For other element types, add the element itself and recurse for its children
            textNodes.push({
              node,
              text: $(node).text(),
              isTextNode: false,
              parent: element,
            });
            collectNodes(node);
          }
        });
    }

    collectNodes($root);

    // If we have only one text node, simple replacement
    if (textNodes.filter((n) => n.isTextNode).length === 1) {
      const textNode = textNodes.find((n) => n.isTextNode);
      if (textNode) {
        $(textNode.node).replaceWith(translatedText);
        return $root.html() || "";
      }
    }

    // Analyze words in both original and translated text for better replacement
    const originalWords = originalText
      .split(/\s+/)
      .filter((w) => w.trim().length > 0);
    const translatedWords = translatedText
      .split(/\s+/)
      .filter((w) => w.trim().length > 0);

    // If word count doesn't match, use a different approach
    if (originalWords.length !== translatedWords.length) {
      // Find text nodes that contain actual text
      const textNodesWithContent = textNodes.filter(
        (node) => node.isTextNode && node.text.trim().length > 0
      );

      // If we have a significant mismatch, proportionally distribute translation
      if (textNodesWithContent.length > 0) {
        const originalLength = originalText.length;
        const translatedLength = translatedText.length;

        let translatedIndex = 0;
        let originalConsumed = 0;

        textNodesWithContent.forEach((nodeInfo, index) => {
          const originalNodeText = nodeInfo.text;
          const originalNodeLength = originalNodeText.length;

          // Calculate how much of the translated text should go here based on proportion
          const proportion = originalNodeLength / originalLength;
          const translatedNodeLength = Math.ceil(translatedLength * proportion);

          // Get the portion of translated text for this node
          let translatedNodeText =
            translatedLength > 0
              ? translatedText.substr(translatedIndex, translatedNodeLength)
              : originalNodeText; // Fallback to original if no translation

          // Handle trailing/leading spaces appropriately
          if (
            originalNodeText.startsWith(" ") &&
            !translatedNodeText.startsWith(" ")
          ) {
            translatedNodeText = " " + translatedNodeText;
          }
          if (
            originalNodeText.endsWith(" ") &&
            !translatedNodeText.endsWith(" ")
          ) {
            translatedNodeText = translatedNodeText + " ";
          }

          // Replace the node's content with sanitized text (ensure no undefined)
          const safeNodeText = translatedNodeText || "";
          $(nodeInfo.node).replaceWith(safeNodeText);

          translatedIndex += translatedNodeLength;
          originalConsumed += originalNodeLength;
        });
      }
    } else {
      // If word count matches, we can do a more precise replacement
      let wordIndex = 0;

      // Go through each node
      textNodes.forEach((nodeInfo) => {
        if (!nodeInfo.isTextNode) return; // Skip non-text nodes

        const nodeText = nodeInfo.text;
        const nodeWords = nodeText.split(/\s+/).filter((w) => w.length > 0);

        if (nodeWords.length === 0) return; // Skip empty nodes

        // Get the corresponding translated words, with safety check
        const availableTranslatedWords = translatedWords.length - wordIndex;
        const wordsToTake = Math.min(
          nodeWords.length,
          availableTranslatedWords
        );

        if (wordsToTake <= 0) {
          // No translated words available, keep original
          return;
        }

        const nodeTranslatedWords = translatedWords.slice(
          wordIndex,
          wordIndex + wordsToTake
        );

        // Create translated text for this node, preserving spacing
        let nodeTranslatedText = "";
        let lastIndex = 0;

        // Replace each word while preserving spaces
        for (
          let i = 0;
          i < Math.min(nodeWords.length, nodeTranslatedWords.length);
          i++
        ) {
          const word = nodeWords[i] || "";
          const translatedWord = nodeTranslatedWords[i] || word; // Fallback to original if no translation

          const wordStart = nodeText.indexOf(word, lastIndex);
          if (wordStart >= 0 && word) {
            // Safety check
            const precedingSpaces = nodeText.substring(lastIndex, wordStart);
            nodeTranslatedText += precedingSpaces + translatedWord;
            lastIndex = wordStart + word.length;
          }
        }

        // Add any trailing spaces
        nodeTranslatedText += nodeText.substring(lastIndex);

        // Replace the node's content with sanitized text
        const safeNodeText = nodeTranslatedText || nodeText; // Fallback to original if empty
        $(nodeInfo.node).replaceWith(safeNodeText);

        wordIndex += wordsToTake;
      });
    }

    // One final check for any 'undefined' strings in the result
    let result = $root.html() || "";
    result = result.replace(/undefined/g, "");

    // Handle any other empty or null values that might have slipped through
    result = result.replace(/null/g, "");
    result = result.replace(/NaN/g, "");

    return result;
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
      const htmlContent = await this.convertPdfToHtml(inputPath);

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
