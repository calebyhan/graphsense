import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParseResult {
  data: Record<string, any>[];
  error?: string;
}

export class FileParser {
  static async parseFile(file: File): Promise<ParseResult> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      switch (extension) {
        case 'csv':
          return await this.parseCSV(file);
        case 'json':
          return await this.parseJSON(file);
        case 'xlsx':
        case 'xls':
          return await this.parseExcel(file);
        case 'tsv':
        case 'txt':
          return await this.parseTSV(file);
        default:
          return { data: [], error: `Unsupported file type: ${extension}` };
      }
    } catch (error) {
      return {
        data: [],
        error: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static async parseCSV(file: File): Promise<ParseResult> {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            const errorMessages = results.errors.map(err => err.message).join(', ');
            resolve({ data: [], error: `CSV parsing error: ${errorMessages}` });
            return;
          }

          if (results.data.length === 0) {
            resolve({ data: [], error: 'The CSV file appears to be empty or has no valid data rows.' });
            return;
          }

          resolve({ data: results.data as Record<string, any>[] });
        },
        error: (error) => {
          resolve({ data: [], error: `Failed to parse CSV file: ${error.message}` });
        }
      });
    });
  }

  private static async parseJSON(file: File): Promise<ParseResult> {
    const text = await file.text();

    try {
      const jsonData = JSON.parse(text);

      // Handle different JSON structures
      let data: Record<string, any>[];

      if (Array.isArray(jsonData)) {
        data = jsonData;
      } else if (jsonData.data && Array.isArray(jsonData.data)) {
        data = jsonData.data;
      } else if (typeof jsonData === 'object') {
        // Convert single object to array
        data = [jsonData];
      } else {
        return { data: [], error: 'JSON must contain an array of objects or a single object' };
      }

      if (data.length === 0) {
        return { data: [], error: 'JSON file contains no data' };
      }

      // Ensure all items are objects
      const validData = data.filter(item => typeof item === 'object' && item !== null);

      if (validData.length === 0) {
        return { data: [], error: 'JSON must contain objects with key-value pairs' };
      }

      return { data: validData };
    } catch (error) {
      return { data: [], error: `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private static async parseExcel(file: File): Promise<ParseResult> {
    const arrayBuffer = await file.arrayBuffer();

    try {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // Get the first worksheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return { data: [], error: 'Excel file contains no worksheets' };
      }

      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        return { data: [], error: 'Excel file must have at least a header row and one data row' };
      }

      // Get headers from first row
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as any[][];

      // Convert to object array
      const data = rows
        .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
        .map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] ?? '';
          });
          return obj;
        });

      if (data.length === 0) {
        return { data: [], error: 'Excel file contains no valid data rows' };
      }

      return { data };
    } catch (error) {
      return { data: [], error: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private static async parseTSV(file: File): Promise<ParseResult> {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: '\t', // Tab-separated
        complete: (results) => {
          if (results.errors.length > 0) {
            const errorMessages = results.errors.map(err => err.message).join(', ');
            resolve({ data: [], error: `TSV parsing error: ${errorMessages}` });
            return;
          }

          if (results.data.length === 0) {
            resolve({ data: [], error: 'The TSV file appears to be empty or has no valid data rows.' });
            return;
          }

          resolve({ data: results.data as Record<string, any>[] });
        },
        error: (error) => {
          resolve({ data: [], error: `Failed to parse TSV file: ${error.message}` });
        }
      });
    });
  }

  static validateDataSize(data: Record<string, any>[]): string | null {
    if (data.length > 50000) {
      return 'Dataset too large. Please upload a file with fewer than 50,000 rows for optimal performance.';
    }
    return null;
  }

  static analyzeDataStructure(data: Record<string, any>[]): {
    columns: string[];
    rowCount: number;
    dataTypes: Record<string, string>;
    preview: Record<string, any>[];
  } {
    if (data.length === 0) {
      return { columns: [], rowCount: 0, dataTypes: {}, preview: [] };
    }

    const columns = Object.keys(data[0]);
    const dataTypes: Record<string, string> = {};

    // Analyze data types for each column
    columns.forEach(column => {
      const sampleValues = data.slice(0, 100).map(row => row[column]).filter(val => val !== null && val !== undefined && val !== '');

      if (sampleValues.length === 0) {
        dataTypes[column] = 'text';
        return;
      }

      // Check if all values are numbers
      const numericValues = sampleValues.filter(val => !isNaN(Number(val)));
      if (numericValues.length === sampleValues.length) {
        dataTypes[column] = 'numeric';
        return;
      }

      // Check if values look like dates
      const dateValues = sampleValues.filter(val => {
        const date = new Date(val);
        return !isNaN(date.getTime());
      });
      if (dateValues.length > sampleValues.length * 0.8) {
        dataTypes[column] = 'temporal';
        return;
      }

      // Check for boolean-like values
      const booleanLike = sampleValues.filter(val =>
        typeof val === 'boolean' ||
        String(val).toLowerCase() === 'true' ||
        String(val).toLowerCase() === 'false' ||
        val === 1 || val === 0
      );
      if (booleanLike.length === sampleValues.length) {
        dataTypes[column] = 'boolean';
        return;
      }

      // Default to categorical for small unique value sets, otherwise text
      const uniqueValues = new Set(sampleValues);
      if (uniqueValues.size <= sampleValues.length * 0.5 && uniqueValues.size <= 20) {
        dataTypes[column] = 'categorical';
      } else {
        dataTypes[column] = 'text';
      }
    });

    return {
      columns,
      rowCount: data.length,
      dataTypes,
      preview: data.slice(0, 5) // First 5 rows for preview
    };
  }
}