	function moveFilterSVG() {
  	const defs = document.querySelector('svg.react-flow__edges.react-flow__container defs');
    if (!defs) return;
  	const chalkFilterEl = document.getElementById('chalk-filter');
    if (!chalkFilterEl) return;
    defs.appendChild(chalkFilterEl);
  }
  const { useState, useEffect, useMemo, useCallback, useRef } = React;
  function ReactFlowDiagram() {
    const {
      ReactFlowProvider,
      useNodesState,
      useEdgesState,
      Controls,
      Background,
      ReactFlow,
      MarkerType,
      Handle,
      Position,
      MiniMap,
      useReactFlow,
      Panel,
    } = window.ReactFlow;
    const elk = new ELK();
    const elkLayoutOptions = {
      'elk.algorithm': 'mrtree', /* 'layered', */
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '160',
    };
    const CustomNode = React.memo(({ data }) => {
      return (
      <>
        <Handle type="target" position={Position.Top} isConnectable={false} />
        <div className="w-40 text-center">
          <div> { /* <div className="p-3"> */ }
            { data.image && (
              <div className="node-media">
                <img
                  src={data.image}
                  alt={data.name}
                  className="w-25 h-25 object-cover mx-auto"
                />
                { data.video && (
                  <video ref={el => { if (el) el.muted = true; }} muted playsInline preload="metadata" data-hover-video="true">
                    <source src={data.video} type="video/webm" />
                    { /^assets\/hover\/.+\.webm$/i.test(data.video) && <source src={data.video.replace(/\.webm$/i, '.mp4')} type="video/mp4" /> }
                  </video>
                ) }
              </div>
            ) }
            <p className="text-sm font-bold text-stone-800">{data.name}</p>
          </div>
        </div>
        <Handle type="source" position={Position.Bottom} isConnectable={false} />
        </>
      );
    });
    const DiagramApp = () => {
      const [nodes, setNodes, onNodesChange] = useNodesState([]);
      const [edges, setEdges, onEdgesChange] = useEdgesState([]);
      const [isLayouting, setIsLayouting] = useState(true);
      const [filteredItems, setFilteredItems] = useState([]);
	  	const { zoomTo, setCenter, getViewport, getZoom, fitView } = useReactFlow();
      // phones: a small map in the corner that expands so you can tap where to go
      const isPhone = window.innerWidth <= 600;
      const [mapOpen, setMapOpen] = useState(false);
      useEffect(() => {
        const handleFilteredItems = () => {
          setFilteredItems(window.filteredItems);
        };
        window.addEventListener('globalFilteredItems', handleFilteredItems);
      }, []);
      useEffect(() => {
      	window.setTimeout(() => {
          moveFilterSVG();
        }, 750);
      }, [isLayouting])
      const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
      const onNodeClick = useCallback((event, node) => {
          // console.log(`Clicked item ID: ${node.id} --- Line 70`);
          // the Popsy logo in the middle goes home: closes the overlay when the tree is
          // open over the grid, otherwise loads the homepage
          if (node.id === 'popsy-wolf') {
            const embedded = document.documentElement.classList.contains('is-embed') && window.parent !== window;
            if (embedded) window.parent.postMessage({ type: 'popsy:close-family' }, location.origin);
            else window.location.href = '/';
            return;
          }
          const selectedItem = window.items.find(el => el.id === node.id)
          // open the piece popup (photo/video, story, Inquire form)
          if (selectedItem && window.PiecePopup) window.PiecePopup.open(selectedItem);
      }, []);
      useEffect(() => {
        const items = window.filteredItems || [];
        if (!items.length) {
          console.warn("window.items is not defined or is empty.");
          setIsLayouting(false);
          return;
        }
        const elkNodes = [];
        const elkEdges = [];
        for (const item of items) {
          elkNodes.push({
            id: item.id,
            width: 160, // w-40
            height: 170, // approximate height of custom node
          });
          if (item.parent && items.find(i => i.id === item.parent)) {
          /* if (item.parent) { */
            elkEdges.push({
              id: `e-${item.parent}-${item.id}`,
              sources: [item.parent],
              targets: [item.id],
            });
          }
        }
        const graph = {
          id: 'root',
          layoutOptions: elkLayoutOptions,
          children: elkNodes,
          edges: elkEdges,
        };
        elk.layout(graph)
          .then((layoutedGraph) => {
              const reactFlowNodes = layoutedGraph.children.map((node) => ({
                  id: node.id,
                  type: 'custom',
                  position: { x: node.x, y: node.y },
                  data: window.filteredItems.find(item => item.id === node.id),
              }));
              const reactFlowEdges = items
                  .filter(item => {
                    const t = item.parent && items.find(i => i.id === item.parent);
                    return t;
                  })
                  .map(item => ({
                      id: `e-${item.parent}-${item.id}`,
                      source: item.parent,
                      target: item.id,
                      label: item.label,
                      /* markerEnd: { type: MarkerType.ArrowClosed, color: '#AAA' }, */
                      style: { stroke: '#000', strokeWidth: 5, filter: 'url(#chalk-filter)', willChange: 'filter' },
                  }));
              setNodes(reactFlowNodes);
              setEdges(reactFlowEdges);
              setIsLayouting(false);
              document.body.dataset.loaded = 't';
              // Open centered on the Popsy logo (the root of the tree), then build the tree in
              const rootNodes = layoutedGraph.children.filter(node => {
                const originalItem = window.items.find(item => item.id === node.id);
                return originalItem && !originalItem.parent;
              });
              const highestNode = rootNodes.length ? rootNodes.reduce((prev, current) => (prev.y < current.y ? prev : current)) : null;
              const logoView = () => {
                if (!highestNode) return null;
                // zoomed out enough to watch the branches spread and cascade down from the logo
                const zoomP = window.innerWidth < 600 ? 0.6 : Math.max(0.5, Math.min(1.15, window.innerWidth / 2900));
                const nodeEl = document.querySelector(`.react-flow__node[data-id="${highestNode.id}"]`);
                const media = nodeEl && nodeEl.querySelector('.node-media');
                // center on the logo image itself (the node also holds a name label under it)
                const mediaOffset = media ? (media.offsetTop + media.offsetHeight / 2) : highestNode.height / 2;
                // phones: logo sits up in the top row, level with "about" and "back",
                // so the tree fills the screen below it
                let raise = 0;
                // also inside the grid's overlay card, where a centered logo leaves the top half empty
                if (window.innerWidth < 600 || document.documentElement.classList.contains('is-embed')) {
                  const about = document.querySelector('.about-link');
                  const rowY = about ? about.getBoundingClientRect().top + about.offsetHeight / 2 : 42;
                  // never let the top of the logo touch the screen edge
                  const halfLogo = (media ? media.offsetHeight : 160) * zoomP / 2;
                  const pad = document.documentElement.classList.contains('is-embed') ? 24 : 10;
                  raise = (window.innerHeight / 2 - Math.max(rowY, halfLogo + pad)) / zoomP;
                }
                return { x: highestNode.x + highestNode.width / 2, y: highestNode.y + mediaOffset + raise, zoom: zoomP };
              };
              // First look: the whole tree, zoomed out, building itself; then a slow glide in to
              // the logo at the top center. Any drag, pinch or scroll before then cancels the glide.
              const openTree = () => {
                const view = logoView();
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (!view || reduce) {
                  if (view) setCenter(view.x, view.y, { zoom: view.zoom, duration: 0 });
                  return window.familyIntro ? window.familyIntro(reactFlowEdges) : null;
                }
                fitView({ padding: 0.06, duration: 0 });
                const tl = window.familyIntro ? window.familyIntro(reactFlowEdges) : null;
                const wait = tl && tl.duration ? Math.min(tl.duration() * 0.7, 2.8) * 1000 : 600;
                const pane = document.querySelector('.react-flow');
                const cancel = () => { clearTimeout(glide); stop(); };
                const stop = () => ['pointerdown', 'wheel', 'touchstart'].forEach(t => pane && pane.removeEventListener(t, cancel));
                ['pointerdown', 'wheel', 'touchstart'].forEach(t => pane && pane.addEventListener(t, cancel, { passive: true }));
                const glide = setTimeout(() => { stop(); setCenter(view.x, view.y, { zoom: view.zoom, duration: 1900 }); }, wait);
              };
              const waitForTree = (tries = 0) => {
                const drawn = document.querySelectorAll('.react-flow__edge-path').length;
                if ((drawn < reactFlowEdges.length || !document.querySelector('.react-flow__node')) && tries < 120) {
                  return requestAnimationFrame(() => waitForTree(tries + 1));
                }
                openTree();
              };
              requestAnimationFrame(() => waitForTree());
          })
          .catch(console.error);
      }, [filteredItems, setCenter, fitView]);
      if (isLayouting) {
            return (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#888', backgroundColor: '#fff' }}>
                  Initializing...
              </div>
          );
      }
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                attributionPosition="bottom-left"
                nodesDraggable={false}
                onNodeClick={onNodeClick}
                onPaneClick={() => setMapOpen(false)}
                onMoveStart={(e) => { if (e) setMapOpen(false); }}
                minZoom={0.1}
            >
                {!isPhone && <MiniMap zoomable pannable nodeStrokeWidth={3} />}
                {isPhone && (
                  <MiniMap
                    className={'fm-map' + (mapOpen ? ' --open' : '')}
                    style={mapOpen
                      ? { width: window.innerWidth - 30, height: Math.round((window.innerWidth - 30) * 0.62) }
                      : { width: 104, height: 72 }}
                    nodeColor="#8c8c8c"
                    nodeStrokeWidth={3}
                    maskColor="rgba(255, 255, 255, 0.6)"
                    maskStrokeColor="#000"
                    maskStrokeWidth={2}
                    onClick={(e, pos) => {
                      if (!mapOpen) { setMapOpen(true); return; }
                      setCenter(pos.x, pos.y, { zoom: getZoom(), duration: 900 });
                      setMapOpen(false);
                    }}
                  />
                )}
                {isPhone && (
                  <Panel position="bottom-right" className="fm-map-label"
                    style={{ bottom: (mapOpen ? Math.round((window.innerWidth - 30) * 0.62) : 72) + 20 }}>
                    {mapOpen
                      ? <button type="button" onClick={() => setMapOpen(false)}>tap where to go <span aria-hidden="true">×</span></button>
                      : <button type="button" onClick={() => setMapOpen(true)}>map</button>}
                  </Panel>
                )}
                {!(isPhone && mapOpen) && <Controls showInteractive={false} />}
                { /* <Background color="#CCCCCC" gap={16} /> */ }
            </ReactFlow>
        </div>
      );
    };
    return (
      <ReactFlowProvider>
        <DiagramApp />
      </ReactFlowProvider>
    );
  }
  function App() {
      const [isReady, setIsReady] = useState(!!window.ReactFlow && !!window.ELK);
      useEffect(() => {
          if (isReady) return;
          const intervalId = setInterval(() => {
              if (window.ReactFlow && window.ELK) {
                  setIsReady(true);
                  clearInterval(intervalId);
              }
          }, 100); 
          return () => clearInterval(intervalId);
      }, [isReady]);
      if (!isReady) {
          return (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#888', backgroundColor: '#fff' }}>
                  Initializing...
              </div>
          );
      }
      return <ReactFlowDiagram />;
  }
  const container = document.getElementById('root');
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
