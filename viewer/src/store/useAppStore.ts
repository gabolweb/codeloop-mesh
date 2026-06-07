import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Position } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import dagre from 'dagre';

// Custom storage for zustand using indexedDB
const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export type NodeCustomization = {
  color?: string;
  emoji?: string;
  notes?: string;
  isMinimized?: boolean;
};

export type ViewState = {
  id: string;
  nodes: Node[];
  edges: Edge[];
  focusNode?: string | null;
};

export type GlobalState = {
  // Current user session
  username: string | null;
  setUsername: (name: string) => void;
  logout: () => void;

  // React Flow multi-view state
  views: Record<string, ViewState>;
  activeViewIds: string[];
  setNodes: (viewId: string, nodes: Node[] | ((val: Node[]) => Node[])) => void;
  setEdges: (viewId: string, edges: Edge[] | ((val: Edge[]) => Edge[])) => void;
  onNodeDragStop: () => void;
  
  addSplitView: (cloneViewId: string) => void;
  removeSplitView: (viewId: string) => void;
  triggerCenter: (viewId: string) => void;
  triggerFocus: (viewId: string, nodeId: string) => void;
  clearFocus: (viewId: string) => void;

  // Customizations (parallel to canonical)
  customizations: Record<string, NodeCustomization>;
  updateCustomization: (nodeId: string, custom: Partial<NodeCustomization>) => void;
  
  // Data Overrides for JSON Editing
  nodeDataOverrides: Record<string, Record<string, any>>;
  updateNodeDataOverride: (nodeId: string, path: string, value: any) => void;

  // History stack for customizations/positions across all views
  history: Array<{ views: Record<string, ViewState>; customizations: Record<string, NodeCustomization>; nodeDataOverrides: Record<string, Record<string, any>>; activeViewIds: string[] }>;
  historyIndex: number;
  pushToHistory: () => void;
  undo: () => void;
  redo: () => void;
  
  // Data loading
  loadCanonicalData: (nodes: Node[], edges: Edge[]) => void;
  importBackup: (state: any) => void;
  loadIdentityDetails: (slug: string, viewId: string) => Promise<void>;
  
  // Layout
  autoLayout: (viewId: string, direction: 'TB' | 'LR') => void;
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, ranksep: 150, nodesep: 150 });

  nodes.forEach((node) => {
    const width = node.type === 'resource' ? 250 : 350;
    const height = node.type === 'resource' ? 100 : 150;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.type === 'resource' ? 250 : 350;
    const height = node.type === 'resource' ? 100 : 150;
    
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const useAppStore = create<GlobalState>()(
  persist(
    (set, get) => ({
      username: null,
      setUsername: (name) => set({ username: name }),
      logout: () => set({ username: null }),

      views: {
        'main': { id: 'main', nodes: [], edges: [] }
      },
      activeViewIds: ['main'],

      setNodes: (viewId, updater) => set((state) => {
        const view = state.views[viewId];
        if (!view) return state;
        const newNodes = typeof updater === 'function' ? updater(view.nodes) : updater;
        return { views: { ...state.views, [viewId]: { ...view, nodes: newNodes } } };
      }),
      
      setEdges: (viewId, updater) => set((state) => {
        const view = state.views[viewId];
        if (!view) return state;
        const newEdges = typeof updater === 'function' ? updater(view.edges) : updater;
        return { views: { ...state.views, [viewId]: { ...view, edges: newEdges } } };
      }),
      
      onNodeDragStop: () => {
        get().pushToHistory();
      },

      addSplitView: (cloneViewId) => {
        const { views, activeViewIds } = get();
        if (activeViewIds.length >= 2) return; // Limit to 2 views for now
        
        const newViewId = `split-${Date.now()}`;
        const sourceView = views[cloneViewId] || views['main'];
        
        get().pushToHistory();
        set({
          views: {
            ...views,
            [newViewId]: {
              id: newViewId,
              // deep copy nodes/edges to prevent reference sharing
              nodes: JSON.parse(JSON.stringify(sourceView.nodes)),
              edges: JSON.parse(JSON.stringify(sourceView.edges)),
            }
          },
          activeViewIds: [...activeViewIds, newViewId]
        });
      },

      removeSplitView: (viewId) => {
        const { activeViewIds } = get();
        if (activeViewIds.length <= 1) return;
        
        get().pushToHistory();
        set({
          activeViewIds: activeViewIds.filter(id => id !== viewId)
        });
      },

      triggerCenter: (viewId) => {
        const { views } = get();
        const view = views[viewId];
        if (view) {
          set({
            views: {
              ...views,
              [viewId]: { ...view, focusNode: 'center_all' }
            }
          });
        }
      },

      triggerFocus: (viewId, nodeId) => {
        const { views } = get();
        const view = views[viewId];
        if (view) {
          set({
            views: {
              ...views,
              [viewId]: { ...view, focusNode: nodeId }
            }
          });
        }
      },

      clearFocus: (viewId) => {
        const { views } = get();
        const view = views[viewId];
        if (view && view.focusNode) {
          set({
            views: {
              ...views,
              [viewId]: { ...view, focusNode: null }
            }
          });
        }
      },

      customizations: {},
      updateCustomization: (nodeId, custom) => {
        get().pushToHistory();
        set((state) => ({
          customizations: {
            ...state.customizations,
            [nodeId]: { ...(state.customizations[nodeId] || {}), ...custom }
          }
        }));
      },

      nodeDataOverrides: {},
      updateNodeDataOverride: (nodeId, path, value) => {
        get().pushToHistory();
        set((state) => {
          const newOverrides = { ...state.nodeDataOverrides };
          const nodeOverride = JSON.parse(JSON.stringify(newOverrides[nodeId] || {}));
          
          const parts = path.split('.');
          let current = nodeOverride;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]] || typeof current[parts[i]] !== 'object') current[parts[i]] = {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = value;

          return {
            nodeDataOverrides: { ...state.nodeDataOverrides, [nodeId]: nodeOverride }
          };
        });
      },

      history: [],
      historyIndex: -1,
      pushToHistory: () => {
        const { views, customizations, nodeDataOverrides, history, historyIndex, activeViewIds } = get();
        // create a deep copy of views for history
        const viewsCopy = JSON.parse(JSON.stringify(views));
        const overridesCopy = JSON.parse(JSON.stringify(nodeDataOverrides || {}));
        const currentSnapshot = { views: viewsCopy, customizations, nodeDataOverrides: overridesCopy, activeViewIds };
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(currentSnapshot);
        // keep last 50 states
        if (newHistory.length > 50) newHistory.shift();
        set({ history: newHistory, historyIndex: newHistory.length - 1 });
      },
      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
          const prevState = history[historyIndex - 1];
          set({
            views: JSON.parse(JSON.stringify(prevState.views)),
            customizations: prevState.customizations,
            nodeDataOverrides: prevState.nodeDataOverrides,
            activeViewIds: prevState.activeViewIds,
            historyIndex: historyIndex - 1
          });
        }
      },
      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          const nextState = history[historyIndex + 1];
          set({
            views: JSON.parse(JSON.stringify(nextState.views)),
            customizations: nextState.customizations,
            nodeDataOverrides: nextState.nodeDataOverrides,
            activeViewIds: nextState.activeViewIds,
            historyIndex: historyIndex + 1
          });
        }
      },

      loadCanonicalData: (nodes, edges) => {
        get().pushToHistory();
        set({ 
          views: {
            'main': { id: 'main', nodes, edges }
          },
          activeViewIds: ['main']
        });
      },
      
      importBackup: (backupState) => {
        // Handle backwards compatibility if backup was from single view
        if (backupState.nodes && !backupState.views) {
           set({
             views: { 'main': { id: 'main', nodes: backupState.nodes, edges: backupState.edges || [] } },
             activeViewIds: ['main'],
             customizations: backupState.customizations || {},
             nodeDataOverrides: backupState.nodeDataOverrides || {},
             history: [],
             historyIndex: -1,
           });
           return;
        }

        set({
           views: backupState.views || { 'main': { id: 'main', nodes: [], edges: [] } },
           activeViewIds: backupState.activeViewIds || ['main'],
           customizations: backupState.customizations || {},
           nodeDataOverrides: backupState.nodeDataOverrides || {},
           history: backupState.history || [],
           historyIndex: backupState.historyIndex || -1,
        });
      },

      autoLayout: (viewId, direction) => {
        const { views } = get();
        const view = views[viewId];
        if (!view) return;
        
        get().pushToHistory();
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(view.nodes, view.edges, direction);
        set({ 
          views: {
            ...views,
            [viewId]: { ...view, nodes: layoutedNodes, edges: layoutedEdges }
          }
        });
      },

      loadIdentityDetails: async (slug: string, viewId: string) => {
        try {
          const identityModules = import.meta.glob('../../../canonical/identities/*.json');
          const modulePath = `../../../canonical/identities/${slug}.json`;
          
          if (!identityModules[modulePath]) {
            throw new Error(`Identity module not found: ${modulePath}`);
          }
          
          const detailModule = await identityModules[modulePath]() as any;
          const data = detailModule.default || detailModule;
          
          const view = get().views[viewId];
          if (!view) return;

          let currentNodes = [...view.nodes];
          const currentEdges = [...view.edges];
          
          // Avoid duplicate sub-nodes
          if (currentNodes.find(n => n.id === `${slug}-core`)) return;

          const basePos = currentNodes.find(n => n.id === slug)?.position || { x: 0, y: 0 };
          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];
          
          let yOffsetLevel1 = 0;

          const createSubNode = (idSuffix: string, label: string, info: any, xOffset: number, yOffset: number) => {
            const nodeId = `${slug}-${idSuffix}`;
            newNodes.push({
              id: nodeId,
              type: 'resource',
              position: { x: basePos.x + xOffset, y: basePos.y + yOffset },
              data: { label, info, parentEntity: slug }
            });
            return nodeId;
          };
          
          const connect = (source: string, target: string) => {
             newEdges.push({
              id: `e-${source}-${target}`,
              source,
              target,
              sourceHandle: 'right',
              targetHandle: 'left',
              type: 'smoothstep',
              animated: true,
              style: { stroke: 'hsl(var(--primary))', strokeWidth: 3, opacity: 1 }
            });
          };

          if (data.brand_core) {
             const id = createSubNode('core', 'Brand Core', data.brand_core, 450, yOffsetLevel1);
             connect(slug, id);
             yOffsetLevel1 += 130;
          }
          if (data.brand_voice) {
             const id = createSubNode('voice', 'Brand Voice', data.brand_voice, 450, yOffsetLevel1);
             connect(slug, id);
             yOffsetLevel1 += 130;
          }
          if (data.design_system) {
             const id = createSubNode('design', 'Design System', data.design_system, 450, yOffsetLevel1);
             connect(slug, id);
             yOffsetLevel1 += 130;
          }
          if (data.brand_assets) {
             const id = createSubNode('assets', 'Brand Assets', data.brand_assets, 450, yOffsetLevel1);
             connect(slug, id);
             yOffsetLevel1 += 130;
          }
          
          ['seo', 'tracking', 'compliance', 'social', 'communication', 'audiences', 'content_gaps'].forEach(key => {
             if (data[key]) {
               const title = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
               const id = createSubNode(key, title, data[key], 450, yOffsetLevel1);
               connect(slug, id);
               yOffsetLevel1 += 130;
             }
          });
          
          if (data.domains && data.domains.domains) {
            const domId = createSubNode('domains', 'Domains', data.domains.domains, 450, yOffsetLevel1);
            connect(slug, domId);
            
            let yOffsetLevel2 = yOffsetLevel1;
            data.domains.domains.forEach((d: any, i: number) => {
              const dId = `${slug}-domain-${i}`;
              newNodes.push({
                id: dId,
                type: 'resource',
                position: { x: basePos.x + 850, y: basePos.y + yOffsetLevel2 },
                data: { label: d.domain, info: d, parentEntity: slug, subType: 'domain' }
              });
              connect(domId, dId);
              yOffsetLevel2 += 130;
            });
            yOffsetLevel1 = Math.max(yOffsetLevel1 + 130, yOffsetLevel2);
          }

          if (data.websites && data.websites.length > 0) {
            const websId = createSubNode('websites', 'Websites', null, 450, yOffsetLevel1);
            connect(slug, websId);
            
            let yOffsetLevel2 = yOffsetLevel1;
            
            data.websites.forEach((w: any, i: number) => {
              const wId = `${slug}-web-${i}`;
              newNodes.push({
                id: wId,
                type: 'resource',
                position: { x: basePos.x + 850, y: basePos.y + yOffsetLevel2 },
                data: { label: w.domain, info: w, parentEntity: slug, subType: 'website' }
              });
              connect(websId, wId);
              
              let nextLevel2Y = yOffsetLevel2 + 130;
              
              if (w.pages && w.pages.length > 0) {
                 const pagesId = `${wId}-pages`;
                 newNodes.push({
                    id: pagesId,
                    type: 'resource',
                    position: { x: basePos.x + 1250, y: basePos.y + yOffsetLevel2 },
                    data: { label: 'Pages', info: w.pages, parentEntity: slug }
                 });
                 connect(wId, pagesId);
                 
                 let yOffsetLevel4 = yOffsetLevel2;
                 w.pages.slice(0, 5).forEach((pageId: string, pIdx: number) => {
                    const actualPage = data.pages?.find((p: any) => p.id === pageId);
                    const pId = `${pagesId}-${pIdx}`;
                    newNodes.push({
                      id: pId,
                      type: 'resource',
                      position: { x: basePos.x + 1650, y: basePos.y + yOffsetLevel4 },
                      data: { label: actualPage?.title || pageId, info: actualPage || null, parentEntity: slug, subType: 'page' }
                    });
                    connect(pagesId, pId);
                    
                    let nextLevel4Y = yOffsetLevel4 + 130;
                    
                    if (actualPage?.sections && actualPage.sections.length > 0) {
                       let yOffsetLevel5 = yOffsetLevel4;
                       actualPage.sections.slice(0, 10).forEach((section: any, sIdx: number) => {
                          const sId = `${pId}-sec-${sIdx}`;
                          newNodes.push({
                            id: sId,
                            type: 'resource',
                            position: { x: basePos.x + 2050, y: basePos.y + yOffsetLevel5 },
                            data: { label: section.section_key || section.pod || 'Section', info: section, parentEntity: slug, subType: 'section' }
                          });
                          connect(pId, sId);
                          yOffsetLevel5 += 130;
                       });
                       nextLevel4Y = Math.max(nextLevel4Y, yOffsetLevel5);
                    }
                    
                    yOffsetLevel4 = nextLevel4Y;
                 });
                 nextLevel2Y = Math.max(nextLevel2Y, yOffsetLevel4);
              }
              yOffsetLevel2 = nextLevel2Y;
            });
            yOffsetLevel1 = Math.max(yOffsetLevel1 + 130, yOffsetLevel2);
          }

          // Focus Mode: Hide other root entities
          currentNodes = currentNodes.map(node => {
            if (node.type === 'entity' && node.id !== slug && !node.id.startsWith('eco-')) {
              return { ...node, hidden: true };
            }
            return node;
          });

          get().pushToHistory();
          set((state) => ({ 
            views: {
              ...state.views,
              [viewId]: {
                ...state.views[viewId],
                nodes: [...currentNodes, ...newNodes],
                edges: [...currentEdges, ...newEdges],
                focusNode: slug // signal canvas to focus here
              }
            }
          }));
          
        } catch (error) {
          console.error("Failed to load identity details:", error);
        }
      }
    }),
    {
      name: 'identity-schema-storage',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => {
        // Exclude ephemeral deep-tree nodes (type: 'resource') from being persisted
        const filteredViews: Record<string, any> = {};
        Object.keys(state.views).forEach(vid => {
           const v = state.views[vid];
           filteredViews[vid] = {
             ...v,
             nodes: v.nodes.filter(n => n.type === 'entity').map(n => ({ ...n, hidden: false })),
             edges: v.edges.filter(e => {
               // Only keep edges that connect entities to entities
               const srcIsEntity = v.nodes.find(n => n.id === e.source)?.type === 'entity';
               const tgtIsEntity = v.nodes.find(n => n.id === e.target)?.type === 'entity';
               return srcIsEntity && tgtIsEntity;
             })
           };
        });

        return {
          username: state.username, 
          views: filteredViews,
          activeViewIds: state.activeViewIds,
          customizations: state.customizations,
          nodeDataOverrides: state.nodeDataOverrides,
          history: state.history,
          historyIndex: state.historyIndex
        };
      },
    }
  )
);
