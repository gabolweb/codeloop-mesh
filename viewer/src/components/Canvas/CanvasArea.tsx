import { useCallback, useEffect, createContext } from 'react';
import ReactFlow, { Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, addEdge, useReactFlow } from 'reactflow';
import type { NodeChange, EdgeChange, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppStore } from '@/store/useAppStore';
import { EntityNode } from '../Nodes/EntityNode';
import { ResourceNode } from '../Nodes/ResourceNode';

export const ViewContext = createContext<string>('main');

const nodeTypes = {
  entity: EntityNode,
  resource: ResourceNode,
};

// We wrap the actual canvas logic in a component that has access to useReactFlow
const CanvasAreaInner = ({ viewId }: { viewId: string }) => {
  const { views, setNodes, setEdges, onNodeDragStop, clearFocus } = useAppStore();
  const { fitView } = useReactFlow();
  
  const view = views[viewId] || { nodes: [], edges: [], focusNode: null };
  const { nodes, edges, focusNode } = view;

  // Handle focus requests
  useEffect(() => {
    if (focusNode) {
      if (focusNode === 'center_all') {
        fitView({ duration: 800, padding: 0.2 });
      } else {
        // focus on specific node and its immediate children (or just the node to let the user see the new tree)
        fitView({ nodes: [{ id: focusNode }], duration: 800, maxZoom: 0.8 });
      }
      // clear focus flag so user can pan away freely
      clearFocus(viewId);
    }
  }, [focusNode, fitView, clearFocus, viewId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes(viewId, (nds) => applyNodeChanges(changes, nds)),
    [setNodes, viewId]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges(viewId, (eds) => applyEdgeChanges(changes, eds)),
    [setEdges, viewId]
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges(viewId, (eds) => addEdge(params, eds)),
    [setEdges, viewId]
  );

  return (
    <ViewContext.Provider value={viewId}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        className="touch-none bg-grid-pattern"
        minZoom={0.1}
      >
        <Background color="var(--border)" gap={24} size={1} />
        <Controls className="bg-background border-border fill-foreground" />
        <MiniMap 
          zoomable
          pannable
          nodeColor={(n) => {
            if (n.type === 'entity') return 'var(--primary)';
            if (n.data?.subType === 'domain') return '#3b82f6';
            if (n.data?.subType === 'website') return '#10b981';
            return 'var(--muted-foreground)';
          }}
          maskColor="var(--background)"
          className="bg-card border-border"
        />
      </ReactFlow>
    </ViewContext.Provider>
  );
};

// Exported component
export const CanvasArea = ({ viewId }: { viewId: string }) => {
  return <CanvasAreaInner viewId={viewId} />;
};
