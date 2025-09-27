import { NextRequest, NextResponse } from 'next/server';
import { BackendAPIClient } from '@/lib/api/backendClient';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  try {
    const { datasetId } = await params;

    if (!datasetId) {
      return NextResponse.json(
        { error: 'Dataset ID is required' },
        { status: 400 }
      );
    }

    const backendClient = new BackendAPIClient();
    const results = await backendClient.getAnalysisResults(datasetId);

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Results API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to get analysis results',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}