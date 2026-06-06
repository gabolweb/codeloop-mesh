import JSZip from 'jszip';
import { useAppStore } from '../store/useAppStore';

export const exportDataset = async () => {
  const state = useAppStore.getState();
  const { views, customizations, history, historyIndex, activeViewIds } = state;
  
  const dataset = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    views,
    activeViewIds,
    customizations,
    history,
    historyIndex,
  };

  const zip = new JSZip();
  zip.file('dataset.json', JSON.stringify(dataset, null, 2));

  // Generate the zip blob
  const content = await zip.generateAsync({ type: 'blob' });
  
  // Trigger download
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `identity-dataset-backup-${new Date().toISOString().split('T')[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importDataset = async (file: File, overwrite: boolean = true) => {
  try {
    const zip = await JSZip.loadAsync(file);
    const datasetFile = zip.file('dataset.json');
    if (!datasetFile) {
      throw new Error('Invalid backup file: missing dataset.json');
    }

    const content = await datasetFile.async('string');
    const dataset = JSON.parse(content);

    if (overwrite) {
      useAppStore.getState().importBackup(dataset);
    } else {
      // Merge strategy (just an example, customize as needed)
      const currentState = useAppStore.getState();
      useAppStore.getState().importBackup({
        ...currentState,
        customizations: { ...currentState.customizations, ...dataset.customizations },
        // Append history or handle gracefully
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to import dataset:', error);
    return false;
  }
};
