declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: {
      PDFFormatVersion: string;
      IsAcroFormPresent: boolean;
      IsXFAPresent: boolean;
      [key: string]: any;
    };
    metadata: any;
    version: string;
  }

  function PDFParse(
    dataBuffer: Buffer, 
    options?: {
      pagerender?: (pageData: any) => string | null;
      max?: number;
    }
  ): Promise<PDFData>;

  export = PDFParse;
}
