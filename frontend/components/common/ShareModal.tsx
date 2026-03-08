'use client';

import { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, ExternalLink, Users, Globe } from 'lucide-react';
import { SharingService, ShareOptions, ShareResult } from '@/lib/services/sharingService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareOptions: ShareOptions;
}

export default function ShareModal({ isOpen, onClose, shareOptions }: ShareModalProps) {
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setShareResult(null);
      setError('');
      setCopiedStates({});
    }
  }, [isOpen]);

  const handleShare = async () => {
    setIsSharing(true);
    setError('');

    try {
      const result = await SharingService.shareVisualization(shareOptions);
      setShareResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = async (text: string, key: string) => {
    const success = await SharingService.copyToClipboard(text);

    if (success) {
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
    }
  };

  const shareLinks = shareResult ? [
    {
      key: 'url',
      label: 'Share URL',
      value: shareResult.shareUrl,
      description: 'Direct link to view the chart',
      icon: ExternalLink
    },
    {
      key: 'token',
      label: 'Share Token',
      value: shareResult.shareToken,
      description: 'Use this token to access the chart',
      icon: Share2
    }
  ] : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Share2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Share Chart</h2>
              <p className="text-sm text-gray-600">Create a public link to your visualization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!shareResult ? (
            <div className="space-y-4">
              {/* Chart Preview */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">{shareOptions.title || shareOptions.chartConfig.title}</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {shareOptions.description || `${shareOptions.chartType} chart with ${shareOptions.chartConfig.data?.length || 0} data points`}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Globe className="h-3 w-3" />
                  <span>This chart will be publicly accessible via a secure link</span>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-blue-800 font-medium mb-1">Public Sharing</p>
                    <p className="text-blue-700">
                      Anyone with the link will be able to view this chart. The link does not expire unless you delete the shared chart.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSharing ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Creating Link...
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      Create Share Link
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Success Message */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-800 font-medium">
                    Chart shared successfully!
                  </p>
                </div>
              </div>

              {/* Share Links */}
              <div className="space-y-3">
                {shareLinks.map((link) => {
                  const IconComponent = link.icon;
                  const isCopied = copiedStates[link.key];

                  return (
                    <div key={link.key} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <IconComponent className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">{link.label}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{link.description}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={link.value}
                          readOnly
                          className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-md font-mono"
                        />
                        <button
                          onClick={() => handleCopy(link.value, link.key)}
                          className={`px-3 py-2 text-sm rounded-md transition-colors ${
                            isCopied
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3 w-3 inline mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 inline mr-1" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => window.open(shareResult.shareUrl, '_blank')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Shared Chart
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}