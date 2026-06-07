import { memo, useState, useMemo, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { merge } from 'lodash-es';
import { Layers, Link as LinkIcon, FileText, Globe, Box, ChevronDown, ChevronUp, Edit2, Plus, Check, Upload } from 'lucide-react';

type JsonViewerProps = {
  data: any;
  path?: string;
  onEdit: (path: string, val: any) => void;
};

const EditableValue = ({ val, path, onEdit }: { val: any, path: string, onEdit: (path: string, v: any) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(String(val));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isColorHex = typeof val === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(val);
  const isColorRgb = typeof val === 'string' && /^(rgb|hsl)a?\(/i.test(val);
  const isImage = typeof val === 'string' && (val.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i) || val.startsWith('data:image'));

  const handleSave = () => {
    let parsed = tempVal;
    if (typeof val === 'number') parsed = Number(tempVal) as any;
    else if (typeof val === 'boolean') parsed = (tempVal === 'true') as any;
    
    onEdit(path, parsed);
    setIsEditing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          onEdit(path, ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        {isColorHex && (
          <input 
            type="color" 
            value={tempVal} 
            onChange={e => setTempVal(e.target.value)}
            className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
          />
        )}
        <Input 
          value={tempVal} 
          onChange={e => setTempVal(e.target.value)} 
          className="h-6 text-[11px] py-0 px-2 w-full max-w-[200px]"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500 shrink-0" onClick={handleSave}>
          <Check size={12} />
        </Button>
      </div>
    );
  }

  let displayNode = null;
  if (val === null) displayNode = <span className="text-muted-foreground italic">null</span>;
  else if (typeof val === 'boolean') displayNode = <span className="text-purple-500 font-medium">{val ? 'true' : 'false'}</span>;
  else if (typeof val === 'number') displayNode = <span className="text-blue-500 font-medium">{val}</span>;
  else if (typeof val === 'string') {
    if (isImage) {
      displayNode = (
        <div className="flex flex-col gap-1">
          <img src={val} alt="preview" className="max-h-16 rounded border border-border/50 bg-background/50 object-contain" />
          <span className="text-emerald-500 break-words text-[9px] opacity-70 truncate max-w-[200px]">{val}</span>
        </div>
      );
    } else if (val.startsWith('http')) {
      displayNode = <a href={val} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline break-all">{val}</a>;
    } else {
      displayNode = (
        <div className="flex items-center gap-1.5 flex-wrap">
          {(isColorHex || isColorRgb) && (
            <div className="w-3 h-3 rounded-sm border border-border/50 shrink-0" style={{ backgroundColor: val }} title="Color preview" />
          )}
          <span className="text-emerald-500 break-words">"{val}"</span>
        </div>
      );
    }
  }

  return (
    <div className="group flex items-start gap-2">
      <div className="flex-1 overflow-hidden">{displayNode}</div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
        {(typeof val === 'string' && (path.toLowerCase().includes('image') || path.toLowerCase().includes('logo') || path.toLowerCase().includes('icon') || path.toLowerCase().includes('avatar') || path.toLowerCase().includes('cover') || isImage)) && (
          <>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => fileInputRef.current?.click()} title="Upload Image">
              <Upload size={10} />
            </Button>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          </>
        )}
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setTempVal(String(val)); setIsEditing(true); }}>
          <Edit2 size={10} />
        </Button>
      </div>
    </div>
  );
};

const JsonViewer = ({ data, path = '', onEdit }: JsonViewerProps) => {
  const [newKey, setNewKey] = useState('');
  const [isAddingKey, setIsAddingKey] = useState(false);

  if (data === null || typeof data !== 'object') {
    return <EditableValue val={data} path={path} onEdit={onEdit} />;
  }
  
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-muted-foreground">[]</span>;
    return (
      <div className="flex flex-col gap-1 border-l-2 border-border/50 pl-2 ml-1 mt-1">
        {data.map((item, index) => (
          <div key={index} className="flex gap-2">
            <span className="text-muted-foreground/50 text-[10px] select-none mt-0.5">{index}</span>
            <div className="flex-1 overflow-hidden">
              <JsonViewer data={item} path={path ? `${path}.${index}` : `${index}`} onEdit={onEdit} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const keys = Object.keys(data);
  
  return (
    <div className="flex flex-col gap-1 w-full">
      {keys.map(k => (
        <div key={k} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50 bg-background/30">
          <span className="font-semibold text-foreground/80 shrink-0 capitalize text-[11px] min-w-[80px]">
            {k.replace(/_/g, ' ')}
          </span>
          <div className="flex-1 text-[11px] overflow-hidden break-words">
            <JsonViewer data={data[k]} path={path ? `${path}.${k}` : k} onEdit={onEdit} />
          </div>
        </div>
      ))}
      
      {isAddingKey ? (
         <div className="flex items-center gap-1 mt-1">
           <Input 
             placeholder="New key name..." 
             value={newKey} 
             onChange={e => setNewKey(e.target.value)} 
             className="h-6 text-[10px]"
             autoFocus
           />
           <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => {
             if (newKey.trim()) {
               onEdit(path ? `${path}.${newKey.trim()}` : newKey.trim(), "New Value");
               setNewKey('');
               setIsAddingKey(false);
             }
           }}>
             <Check size={12} />
           </Button>
         </div>
      ) : (
         <Button variant="ghost" size="sm" className="h-5 text-[10px] justify-start text-muted-foreground w-24 mt-1" onClick={() => setIsAddingKey(true)}>
           <Plus size={10} className="mr-1" /> Add Field
         </Button>
      )}
    </div>
  );
};

export const ResourceNode = memo(({ id, data }: NodeProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateNodeDataOverride = useAppStore(state => state.updateNodeDataOverride);
  const nodeOverrides = useAppStore(state => state.nodeDataOverrides[id]) || {};
  
  // Merge canonical data with local overrides
  const mergedInfo = useMemo(() => {
    return merge({}, data.info || {}, nodeOverrides);
  }, [data.info, nodeOverrides]);

  const handleEdit = (path: string, val: any) => {
    updateNodeDataOverride(id, path, val);
  };
  
  let Icon = Box;
  if (data.subType === 'domain') Icon = LinkIcon;
  else if (data.subType === 'website') Icon = Globe;
  else if (data.subType === 'page') Icon = FileText;
  else if (data.label.includes('System') || data.label.includes('Core')) Icon = Layers;

  const hasData = data.info && typeof data.info === 'object' && Object.keys(data.info).length > 0;

  return (
    <Card className={`transition-all duration-300 shadow-sm backdrop-blur-md bg-opacity-90 dark:bg-opacity-80 border border-border/40 hover:border-primary/50 ${isExpanded ? 'w-[450px]' : 'w-[250px]'}`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-muted-foreground/50" />
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-muted-foreground/50" id="left" />
      
      <CardContent className="p-3 flex flex-col gap-2">
        <div className="flex items-start gap-3 w-full">
          <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0 mt-0.5">
            <Icon size={16} />
          </div>
          <div className="overflow-hidden flex-1">
            <div className="text-sm font-semibold truncate" title={data.label}>{data.label}</div>
            {data.subType && (
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                {data.subType}
              </div>
            )}
            {!isExpanded && hasData && (
               <div className="mt-1 text-[10px] text-muted-foreground/80 truncate">
                 {Object.keys(data.info).slice(0, 3).join(', ')}...
               </div>
            )}
          </div>
          {hasData && (
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 mt-1" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          )}
        </div>

        {isExpanded && hasData && (
          <div className="mt-2 pt-2 border-t border-border/50 max-h-[350px] overflow-y-auto overflow-x-hidden custom-scrollbar nodrag nowheel">
            <JsonViewer data={mergedInfo} onEdit={handleEdit} />
          </div>
        )}
      </CardContent>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-muted-foreground/50" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-muted-foreground/50" id="right" />
    </Card>
  );
});
