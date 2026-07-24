/* ============================================================
   Broadreach Platform — Grapher chart renderer (Chart.js).
   Thin wrapper: takes an already-shaped Chart.js dataset/scale config
   (see js/grapherMetrics.jsx) and mounts/updates a Chart.js instance.
   Legend-click-to-toggle and hover tooltips are Chart.js defaults, no
   custom code needed. Zoom/pan comes from chartjs-plugin-zoom (CDN,
   see index.html) — if that script fails to self-register for any
   reason, Chart.js just ignores the unrecognized `zoom` options key,
   so this degrades to "no zoom" rather than throwing.
   ============================================================ */

function GrapherChart({ chartType, datasets, scales, xLabel, yLabel, height = 420, chartRef }) {
  const canvasRef = React.useRef(null);
  const instRef = React.useRef(null);

  React.useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;
    if (instRef.current) { instRef.current.destroy(); instRef.current = null; }

    const isScatter = chartType === 'scatter';
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: isScatter ? 'nearest' : 'index', intersect: isScatter },
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } },
        ...(isScatter ? {} : {
          zoom: {
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
            pan: { enabled: true, mode: 'x' },
          },
        }),
      },
      scales: isScatter
        ? { x: { title: { display: true, text: xLabel || '' } }, y: { title: { display: true, text: yLabel || '' } } }
        : scales,
    };

    instRef.current = new Chart(canvasRef.current, {
      type: isScatter ? 'scatter' : 'line',
      data: { datasets },
      options,
    });
    if (chartRef) chartRef.current = instRef.current;

    return () => { if (instRef.current) { instRef.current.destroy(); instRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, datasets, scales, xLabel, yLabel]);

  return <div style={{ height }}><canvas ref={canvasRef}></canvas></div>;
}

Object.assign(window, { GrapherChart });
