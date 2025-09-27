import { NextRequest, NextResponse } from 'next/server';
import { BackendAPIClient } from '@/lib/api/backendClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, filename, file_type, options } = body;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected an array of objects.' },
        { status: 400 }
      );
    }

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'No data provided. Please upload a file with data.' },
        { status: 400 }
      );
    }

    if (data.length > 10000) {
      return NextResponse.json(
        { error: 'Dataset too large. Please upload a file with fewer than 10,000 rows.' },
        { status: 400 }
      );
    }

    // Forward request to Python backend
    const backendClient = new BackendAPIClient();

    // Check if backend is available
    const isBackendAvailable = await backendClient.isAvailable();
    if (!isBackendAvailable) {
      return NextResponse.json(
        { error: 'Backend service is not available. Please try again later.' },
        { status: 503 }
      );
    }

    const result = await backendClient.analyzeDataset({
      data,
      filename: filename || 'dataset.csv',
      file_type: file_type || 'csv',
      options: options || {}
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Analysis API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Analysis failed',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'Analysis API is running',
      version: '1.0.0',
      supportedFormats: ['CSV'],
      maxRows: 10000,
      maxFileSize: '10MB'
    },
    { status: 200 }
  );
}