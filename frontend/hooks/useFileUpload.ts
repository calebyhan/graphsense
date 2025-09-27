import { useRef, useCallback } from 'react';

interface UseFileUploadOptions {
  accept?: string;
  multiple?: boolean;
  onFileSelect: (files: FileList | null) => void;
}

export const useFileUpload = ({ accept, multiple = false, onFileSelect }: UseFileUploadOptions) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    onFileSelect(files);
    // Reset the input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileSelect]);

  const fileInputProps = {
    ref: fileInputRef,
    type: 'file' as const,
    accept,
    multiple,
    onChange: handleFileChange,
    style: { display: 'none' }
  };

  return {
    openFileDialog,
    fileInputProps
  };
};