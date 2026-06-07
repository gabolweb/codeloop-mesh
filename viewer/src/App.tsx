import { useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { useAppStore } from '@/store/useAppStore';
import { CanvasArea } from '@/components/Canvas/CanvasArea';
import { Toolbar } from '@/components/Toolbar/Toolbar';
import { ManagementPanel } from '@/components/Sidebar/ManagementPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Helper to convert JSON schema to ReactFlow nodes/edges
const transformCanonicalToGraph = (data: any) => {
  const nodes: any[] = [];
  const edges: any[] = [];

  // Create Ecosystem root nodes
  const ecosystems = new Set(data.identities.map((i: any) => i.ecosystem));
  Array.from(ecosystems).forEach((eco, i) => {
    nodes.push({
      id: `eco-${eco}`,
      type: 'entity',
      position: { x: i * 500, y: 0 },
      data: { name: eco, type: 'ecosystem', status: 'active', ecosystem: eco }
    });
  });

  // Create Identity nodes
  data.identities.forEach((identity: any, i: number) => {
    nodes.push({
      id: identity.slug,
      type: 'entity',
      position: { x: (i % 5) * 400, y: Math.floor(i / 5) * 300 + 300 },
      data: identity
    });

    // Connect to ecosystem
    edges.push({
      id: `e-eco-${identity.ecosystem}-${identity.slug}`,
      source: `eco-${identity.ecosystem}`,
      target: identity.slug,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'hsl(var(--primary))' }
    });
  });

  return { nodes, edges };
};

function App() {
  const { username, setUsername, activeViewIds, loadCanonicalData, views } = useAppStore();
  const [loginInput, setLoginInput] = useState('');

  useEffect(() => {
    // Auto-load local canonical data if main view has no nodes
    if (username && views['main']?.nodes.length === 0) {
      const loadInitialData = async () => {
        try {
          const indexModule = await import('../../canonical/index.json');
          const graph = transformCanonicalToGraph(indexModule.default || indexModule);
          loadCanonicalData(graph.nodes, graph.edges);
        } catch (e) {
          console.log("Could not auto-load local index.json, user must import ZIP.", e);
        }
      };
      loadInitialData();
    }
  }, [username, views, loadCanonicalData]);

  if (!username) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl backdrop-blur-xl bg-background/90 border-primary/20">
          <CardHeader className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Identity Schema Viewer</CardTitle>
            <CardDescription className="text-base">
              Offline access mode. Enter your username to begin or resume your session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (loginInput) setUsername(loginInput); }} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Input
                  placeholder="Enter username (e.g. Looper)"
                  value={loginInput}
                  onChange={e => setLoginInput(e.target.value)}
                  className="h-12"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full h-12 text-md" disabled={!loginInput}>
                Enter Workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-background text-foreground relative flex">
      <Toolbar />
      <ManagementPanel />

      <div className="flex-1 flex w-full h-full">
        {activeViewIds.map((viewId, index) => (
          <div key={viewId} className={`relative flex-1 h-full ${index > 0 ? 'border-l-4 border-primary/20' : ''}`}>
            <ReactFlowProvider>
              <CanvasArea viewId={viewId} />
            </ReactFlowProvider>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
