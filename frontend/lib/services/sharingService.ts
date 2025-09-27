/**
 * Sharing Service
 * Handles chart sharing functionality with token-based access
 */

import { supabase } from '@/lib/supabase/client';
import { ChartConfig } from '@/lib/types';

export interface ShareOptions {
  chartConfig: ChartConfig;
  chartType: string;
  title?: string;
  description?: string;
  expiresIn?: number; // Hours until expiration
}

export interface ShareResult {
  shareToken: string;
  shareUrl: string;
  expiresAt?: Date;
}

export interface SharedVisualization {
  id: string;
  title: string;
  description?: string;
  chartType: string;
  chartConfig: ChartConfig;
  shareToken: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export class SharingService {
  /**
   * Create a shareable link for a visualization
   */
  static async shareVisualization(options: ShareOptions): Promise<ShareResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User must be authenticated to share visualizations');
      }

      // Insert or update visualization in database
      const { data, error } = await supabase
        .from('visualizations')
        .insert({
          user_id: user.id,
          chart_type: options.chartType,
          title: options.title || options.chartConfig.title,
          description: options.description,
          chart_config: options.chartConfig,
          is_shared: true,
        })
        .select('share_token, id')
        .single();

      if (error) throw error;

      const shareUrl = `${window.location.origin}/shared/${data.share_token}`;

      return {
        shareToken: data.share_token,
        shareUrl,
        ...(options.expiresIn && {
          expiresAt: new Date(Date.now() + options.expiresIn * 60 * 60 * 1000)
        })
      };
    } catch (error) {
      console.error('Failed to share visualization:', error);
      throw new Error('Failed to create shareable link');
    }
  }

  /**
   * Update sharing settings for an existing visualization
   */
  static async updateSharingSettings(
    visualizationId: string,
    isShared: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('visualizations')
        .update({ is_shared: isShared })
        .eq('id', visualizationId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update sharing settings:', error);
      throw new Error('Failed to update sharing settings');
    }
  }

  /**
   * Get shared visualization by token
   */
  static async getSharedVisualization(shareToken: string): Promise<SharedVisualization | null> {
    try {
      const { data, error } = await supabase
        .from('visualizations')
        .select('*')
        .eq('share_token', shareToken)
        .eq('is_shared', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null;
        }
        throw error;
      }

      return {
        id: data.id,
        title: data.title,
        description: data.description,
        chartType: data.chart_type,
        chartConfig: data.chart_config,
        shareToken: data.share_token,
        isShared: data.is_shared,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      console.error('Failed to get shared visualization:', error);
      return null;
    }
  }

  /**
   * Get user's shared visualizations
   */
  static async getUserSharedVisualizations(): Promise<SharedVisualization[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('visualizations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_shared', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        chartType: item.chart_type,
        chartConfig: item.chart_config,
        shareToken: item.share_token,
        isShared: item.is_shared,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
    } catch (error) {
      console.error('Failed to get user shared visualizations:', error);
      return [];
    }
  }

  /**
   * Delete a shared visualization
   */
  static async deleteSharedVisualization(visualizationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('visualizations')
        .delete()
        .eq('id', visualizationId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete shared visualization:', error);
      throw new Error('Failed to delete shared visualization');
    }
  }

  /**
   * Copy share URL to clipboard
   */
  static async copyToClipboard(shareUrl: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Generate share metadata for social sharing
   */
  static generateShareMetadata(visualization: SharedVisualization) {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/shared/${visualization.shareToken}`;

    return {
      title: `${visualization.title} - Auto Visualization Agent`,
      description: visualization.description || `Interactive ${visualization.chartType} chart created with AI-powered analysis`,
      url: shareUrl,
      image: `${baseUrl}/api/og?token=${visualization.shareToken}`, // For Open Graph image
    };
  }

  /**
   * Validate share token format
   */
  static isValidShareToken(token: string): boolean {
    // Assuming tokens are hex strings of specific length
    const tokenRegex = /^[a-f0-9]{32}$/i;
    return tokenRegex.test(token);
  }
}