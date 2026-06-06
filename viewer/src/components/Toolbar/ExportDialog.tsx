import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Database, Download, FileArchive, ArrowRight } from 'lucide-react';
import { generateZipExport, generateSqlExport, syncToNotion } from '@/utils/exportSystem';

export function ExportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExport = async (format: 'zip' | 'mysql' | 'postgres' | 'notion') => {
    setIsExporting(true);
    try {
      if (format === 'zip') await generateZipExport();
      else if (format === 'mysql') await generateSqlExport('mysql');
      else if (format === 'postgres') await generateSqlExport('postgres');
      else if (format === 'notion') await syncToNotion();
    } catch (e) {
      console.error(e);
      alert('Export failed. Check console.');
    } finally {
      setIsExporting(false);
      if (format !== 'notion') setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download size={14} /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Unified Data</DialogTitle>
          <DialogDescription>
            Export all canonical identities combined with your local edits.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <Button 
            variant="outline" 
            className="justify-start gap-3 h-14"
            disabled={isExporting}
            onClick={() => handleExport('zip')}
          >
            <div className="bg-primary/10 p-2 rounded-md text-primary"><FileArchive size={18} /></div>
            <div className="flex-1 text-left">
              <div className="font-semibold">JSON Archive (.zip)</div>
              <div className="text-xs text-muted-foreground font-normal">Raw merged JSON files</div>
            </div>
            <ArrowRight size={16} className="text-muted-foreground" />
          </Button>

          <Button 
            variant="outline" 
            className="justify-start gap-3 h-14"
            disabled={isExporting}
            onClick={() => handleExport('postgres')}
          >
            <div className="bg-blue-500/10 p-2 rounded-md text-blue-500"><Database size={18} /></div>
            <div className="flex-1 text-left">
              <div className="font-semibold">PostgreSQL (.sql)</div>
              <div className="text-xs text-muted-foreground font-normal">Relational insert scripts</div>
            </div>
            <ArrowRight size={16} className="text-muted-foreground" />
          </Button>

          <Button 
            variant="outline" 
            className="justify-start gap-3 h-14"
            disabled={isExporting}
            onClick={() => handleExport('mysql')}
          >
            <div className="bg-orange-500/10 p-2 rounded-md text-orange-500"><Database size={18} /></div>
            <div className="flex-1 text-left">
              <div className="font-semibold">MySQL (.sql)</div>
              <div className="text-xs text-muted-foreground font-normal">Relational insert scripts</div>
            </div>
            <ArrowRight size={16} className="text-muted-foreground" />
          </Button>

          <Button 
            variant="outline" 
            className="justify-start gap-3 h-14"
            disabled={isExporting}
            onClick={() => handleExport('notion')}
          >
            <div className="bg-foreground/10 p-2 rounded-md text-foreground"><Database size={18} /></div>
            <div className="flex-1 text-left">
              <div className="font-semibold">Notion Sync</div>
              <div className="text-xs text-muted-foreground font-normal">Syncs to local server</div>
            </div>
            <ArrowRight size={16} className="text-muted-foreground" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
