import { PostgrestError } from '@supabase/supabase-js';

export interface DatabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
  userMessage: string;
  shouldRetry: boolean;
  retryAfter?: number; // seconds
}

export class DatabaseErrorHandler {
  /**
   * Convert Supabase/PostgreSQL errors to user-friendly error objects
   */
  static handleDatabaseError(error: PostgrestError | Error): DatabaseError {
    // Handle Supabase PostgrestError
    if ('code' in error && 'message' in error) {
      return this.handlePostgrestError(error as PostgrestError);
    }

    // Handle generic errors
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      userMessage: 'An unexpected error occurred. Please try again.',
      shouldRetry: true,
      retryAfter: 5,
    };
  }

  private static handlePostgrestError(error: PostgrestError): DatabaseError {
    const { code, message, details, hint } = error;

    console.error('Database error:', { code, message, details, hint });

    switch (code) {
      // Authentication errors
      case 'PGRST301':
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'Authentication required. Please sign in and try again.',
          shouldRetry: false,
        };

      case 'PGRST302':
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'You do not have permission to perform this action.',
          shouldRetry: false,
        };

      // Not found errors
      case 'PGRST116':
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'The requested data could not be found.',
          shouldRetry: false,
        };

      // Constraint violations
      case '23505': // unique_violation
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'A dataset with this name already exists. Please choose a different name.',
          shouldRetry: false,
        };

      case '23503': // foreign_key_violation
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'Cannot complete this operation due to related data dependencies.',
          shouldRetry: false,
        };

      case '23514': // check_violation
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'The data provided does not meet the required constraints.',
          shouldRetry: false,
        };

      // Connection and timeout errors
      case 'PGRST504':
      case '57014': // query_canceled
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'The operation timed out. Please try again with a smaller dataset.',
          shouldRetry: true,
          retryAfter: 10,
        };

      case '53300': // too_many_connections
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'The service is currently busy. Please try again in a few moments.',
          shouldRetry: true,
          retryAfter: 30,
        };

      // Storage errors
      case '22001': // string_data_right_truncation
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'The data you are trying to save is too large. Please reduce the file size.',
          shouldRetry: false,
        };

      case '22P02': // invalid_text_representation
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'The data format is invalid. Please check your file and try again.',
          shouldRetry: false,
        };

      // Row Level Security (RLS) errors
      case 'PGRST204':
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'You can only access your own data. Please sign in and try again.',
          shouldRetry: false,
        };

      // Generic database errors
      case '42P01': // undefined_table
        return {
          code,
          message,
          details,
          hint,
          userMessage: 'A system error occurred. Please contact support if this persists.',
          shouldRetry: false,
        };

      default:
        // Check if it's a network or connection error
        if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
          return {
            code,
            message,
            details,
            hint,
            userMessage: 'Network connection error. Please check your internet connection and try again.',
            shouldRetry: true,
            retryAfter: 5,
          };
        }

        return {
          code,
          message,
          details,
          hint,
          userMessage: 'An unexpected database error occurred. Please try again or contact support.',
          shouldRetry: true,
          retryAfter: 5,
        };
    }
  }

  /**
   * Get retry strategy for a database error
   */
  static getRetryStrategy(error: DatabaseError): {
    shouldRetry: boolean;
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  } {
    if (!error.shouldRetry) {
      return {
        shouldRetry: false,
        maxRetries: 0,
        retryDelay: 0,
        backoffMultiplier: 1,
      };
    }

    // Default retry strategy
    let maxRetries = 3;
    let retryDelay = error.retryAfter ? error.retryAfter * 1000 : 2000;
    let backoffMultiplier = 1.5;

    // Adjust based on error type
    switch (error.code) {
      case 'PGRST504':
      case '57014': // query timeout
        maxRetries = 2;
        retryDelay = 10000;
        backoffMultiplier = 2;
        break;

      case '53300': // too many connections
        maxRetries = 5;
        retryDelay = 30000;
        backoffMultiplier = 1.2;
        break;

      default:
        if (error.message.includes('network') || error.message.includes('connection')) {
          maxRetries = 5;
          retryDelay = 2000;
          backoffMultiplier = 1.5;
        }
        break;
    }

    return {
      shouldRetry: true,
      maxRetries,
      retryDelay,
      backoffMultiplier,
    };
  }

  /**
   * Format error for user display
   */
  static formatErrorForUser(error: DatabaseError): {
    title: string;
    message: string;
    actions?: Array<{
      label: string;
      action: 'retry' | 'contact_support' | 'check_connection' | 'reduce_file_size';
    }>;
  } {
    const actions: Array<{
      label: string;
      action: 'retry' | 'contact_support' | 'check_connection' | 'reduce_file_size';
    }> = [];

    if (error.shouldRetry) {
      actions.push({ label: 'Try Again', action: 'retry' });
    }

    if (error.message.includes('network') || error.message.includes('connection')) {
      actions.push({ label: 'Check Connection', action: 'check_connection' });
    }

    if (error.code === '22001' || error.message.includes('too large')) {
      actions.push({ label: 'Reduce File Size', action: 'reduce_file_size' });
    }

    if (!error.shouldRetry && !['PGRST301', 'PGRST302', 'PGRST204'].includes(error.code)) {
      actions.push({ label: 'Contact Support', action: 'contact_support' });
    }

    return {
      title: this.getErrorTitle(error),
      message: error.userMessage,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  private static getErrorTitle(error: DatabaseError): string {
    switch (error.code) {
      case 'PGRST301':
      case 'PGRST302':
      case 'PGRST204':
        return 'Authentication Required';

      case 'PGRST116':
        return 'Data Not Found';

      case '23505':
        return 'Duplicate Data';

      case '23503':
        return 'Data Dependencies';

      case 'PGRST504':
      case '57014':
        return 'Operation Timeout';

      case '53300':
        return 'Service Busy';

      case '22001':
        return 'File Too Large';

      case '22P02':
        return 'Invalid Data Format';

      default:
        if (error.message.includes('network') || error.message.includes('connection')) {
          return 'Connection Error';
        }
        return 'Unexpected Error';
    }
  }
}

/**
 * Hook for handling database errors with automatic retry logic
 */
export function useErrorHandler() {
  const handleError = (error: unknown): DatabaseError => {
    if (error instanceof Error) {
      return DatabaseErrorHandler.handleDatabaseError(error);
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      userMessage: 'Something went wrong. Please try again.',
      shouldRetry: true,
      retryAfter: 5,
    };
  };

  const formatError = (error: DatabaseError) => {
    return DatabaseErrorHandler.formatErrorForUser(error);
  };

  const getRetryStrategy = (error: DatabaseError) => {
    return DatabaseErrorHandler.getRetryStrategy(error);
  };

  return {
    handleError,
    formatError,
    getRetryStrategy,
  };
}