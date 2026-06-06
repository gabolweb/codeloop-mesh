import { useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Undo, Redo, Upload, AlignEndVertical, AlignEndHorizontal, Columns, Focus } from 'lucide-react';
import { importDataset } from '@/utils/backupSystem';
import { ExportDialog } from './ExportDialog';

export const Toolbar = () => {
  const { historyIndex, history, undo, redo, autoLayout, addSplitView, removeSplitView, triggerCenter, activeViewIds } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const isSplit = activeViewIds.length > 1;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importDataset(file, true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLayout = (direction: 'TB' | 'LR') => {
    activeViewIds.forEach(id => autoLayout(id, direction));
  };

  const handleCenter = () => {
    activeViewIds.forEach(id => triggerCenter(id));
  };

  const handleSplitToggle = () => {
    if (isSplit) {
      removeSplitView(activeViewIds[1]); // Remove the second view
    } else {
      addSplitView(activeViewIds[0]); // Clone the first view
    }
  };

  return (
    <div className="absolute top-4 left-4 z-10 flex gap-2 p-2 bg-background/80 backdrop-blur-md rounded-xl border border-border shadow-lg">
      <div className="flex items-center gap-1 border-r border-border pr-2">
        <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} title="Undo">
          <Undo size={18} />
        </Button>
        <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} title="Redo">
          <Redo size={18} />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-r border-border pr-2">
        <Button variant="ghost" size="icon" onClick={() => handleLayout('TB')} title="Tree Layout">
          <AlignEndVertical size={18} />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleLayout('LR')} title="Linear Layout">
          <AlignEndHorizontal size={18} />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleCenter} title="Center Canvas">
          <Focus size={18} />
        </Button>
      </div>
      
      <div className="flex items-center gap-1 border-r border-border pr-2">
        <Button 
           variant={isSplit ? 'default' : 'ghost'} 
           size="icon" 
           onClick={handleSplitToggle} 
           title={isSplit ? "Close Split View" : "Split View"}
        >
          <Columns size={18} />
        </Button>
      </div>

      <div className="flex gap-2 items-center px-4">
        <ExportDialog />
        
        <input type="file" ref={fileInputRef} className="hidden" accept=".zip" onChange={handleImport} />
        <Button variant="secondary" size="sm" className="gap-2 text-xs h-9" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> Restore ZIP
        </Button>
      </div>
    </div>
  );
};
