import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, Map as MapIcon, PaintBucket, SmilePlus, LogOut, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { Node } from 'reactflow';

export const ManagementPanel = () => {
  const { views, activeViewIds, username, logout, updateCustomization, triggerFocus } = useAppStore();
  const [search, setSearch] = useState('');

  // Collect all unique nodes from active views
  const uniqueNodesMap = new Map<string, { node: Node, viewId: string }>();
  activeViewIds.forEach(vid => {
    const view = views[vid];
    if (view) {
      view.nodes.forEach(n => {
        if (!uniqueNodesMap.has(n.id)) {
          uniqueNodesMap.set(n.id, { node: n, viewId: vid });
        }
      });
    }
  });

  const allNodes = Array.from(uniqueNodesMap.values());

  const filteredNodes = allNodes.filter(n => 
    n.node.data.name?.toLowerCase().includes(search.toLowerCase()) || 
    n.node.data.ecosystem?.toLowerCase().includes(search.toLowerCase())
  );

  const focusNode = (item: { node: Node, viewId: string }) => {
    triggerFocus(item.viewId, item.node.id);
  };

  const setRandomColor = (id: string) => {
    const colors = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
    const random = colors[Math.floor(Math.random() * colors.length)];
    // Using hex opacity for var(--card) equivalent with color overlay
    updateCustomization(id, { color: `${random}20` }); // 20% opacity
  };

  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <div className="absolute top-4 right-4 z-10">
        <Card className="p-2 bg-background/80 backdrop-blur-md shadow-lg">
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(false)} title="Expand Panel">
            <PanelRightOpen size={16} className="mr-2" /> Search Entities
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-10 w-80 h-[calc(100vh-32px)] flex flex-col gap-4">
      <Card className="p-4 bg-background/80 backdrop-blur-md shadow-lg flex items-center justify-between">
        <div className="font-semibold text-sm">
          {username ? `Logged in as @${username}` : 'Offline Mode'}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(true)} title="Minimize Panel">
            <PanelRightClose size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} title="Logout">
            <LogOut size={16} />
          </Button>
        </div>
      </Card>

      <Card className="flex-1 p-4 bg-background/80 backdrop-blur-md shadow-lg flex flex-col overflow-hidden">
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search entities..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 custom-scrollbar">
          {filteredNodes.map(item => (
            <div key={item.node.id} className="p-3 border border-border/50 rounded-xl bg-card/50 hover:bg-card transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-sm truncate w-40">{item.node.data.name || item.node.data.label}</h4>
                  <p className="text-xs text-muted-foreground">{item.node.data.type || item.node.type}</p>
                </div>
                <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => focusNode(item)}>
                  <MapIcon size={14} />
                </Button>
              </div>
              
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => setRandomColor(item.node.id)}>
                  <PaintBucket size={12} className="mr-1" /> Color
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 flex-1 text-xs" 
                  onClick={() => {
                    const emoji = prompt('Enter an emoji:');
                    if (emoji) updateCustomization(item.node.id, { emoji });
                  }}
                >
                  <SmilePlus size={12} className="mr-1" /> Emoji
                </Button>
              </div>
            </div>
          ))}
          {filteredNodes.length === 0 && (
            <div className="text-center text-muted-foreground text-sm mt-10">
              No entities found.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
