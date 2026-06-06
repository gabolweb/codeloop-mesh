import { memo, useContext } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { useAppStore } from '@/store/useAppStore';
import { ViewContext } from '../Canvas/CanvasArea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, Package, RefreshCw, AlertCircle, Network } from 'lucide-react';
import { cn } from '@/lib/utils';

export const EntityNode = memo(({ data, id, selected }: NodeProps) => {
  const customization = useAppStore(state => state.customizations[id]) || {};
  const loadIdentityDetails = useAppStore(state => state.loadIdentityDetails);
  const viewId = useContext(ViewContext);
  const isMinimized = customization.isMinimized || false;

  const nodeColor = customization.color || 'var(--card)';
  
  return (
    <Card 
      className={cn(
        "w-[350px] shadow-lg transition-all duration-200 backdrop-blur-md bg-opacity-90 dark:bg-opacity-80 border-2",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border/50",
      )}
      style={{ 
        backgroundColor: nodeColor !== 'var(--card)' ? nodeColor : undefined 
      }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-muted-foreground" id="left" />
      
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center gap-3">
        {customization.emoji ? (
          <div className="text-3xl bg-background/50 p-2 rounded-xl backdrop-blur-sm">
            {customization.emoji}
          </div>
        ) : (
          <div className="bg-primary/10 p-2 rounded-xl text-primary">
            {data.type === 'ecosystem' ? <Package size={24} /> : <Globe size={24} />}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <CardTitle className="text-lg font-bold truncate tracking-tight">{data.name}</CardTitle>
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">
            {data.type} • {data.ecosystem}
          </div>
        </div>
      </CardHeader>

      {!isMinimized && (
        <>
          <CardContent className="px-4 pb-2 pt-2">
            {data.domain && (
              <div className="flex items-center gap-2 text-sm mb-3 font-medium text-foreground/80 bg-background/50 p-2 rounded-md">
                <Globe size={14} className="text-muted-foreground" />
                {data.domain}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mb-3">
              <Badge variant={data.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                {data.status}
              </Badge>
              <Badge variant="outline" className="bg-background/50">
                Coverage: {data.kb_coverage}
              </Badge>
            </div>

            {customization.notes && (
              <div className="mt-3 p-3 bg-accent/50 text-accent-foreground text-sm rounded-lg border border-accent">
                <div className="font-semibold text-xs mb-1 uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle size={12} /> Notes
                </div>
                <p className="leading-snug">{customization.notes}</p>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <RefreshCw size={12} /> {data.pages || 0} Pages
              </div>
              <div>{data.sections || 0} Sections</div>
            </div>
          </CardContent>
          <CardFooter className="px-4 pb-4 pt-0">
            <Button 
              variant="secondary" 
              size="sm" 
              className="w-full gap-2 text-xs h-8"
              onClick={() => loadIdentityDetails(data.slug, viewId)}
            >
              <Network size={14} /> Load Deep Tree
            </Button>
          </CardFooter>
        </>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-muted-foreground" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-muted-foreground" id="right" />
    </Card>
  );
});
