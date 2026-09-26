import cytoscape, { type Core } from "cytoscape";
import { useEffect, useRef } from "react";

import type {
  DatasetPayload,
  EvaluationResponse,
  Selection,
} from "../types";

interface Props {
  dataset: DatasetPayload;
  evaluation: EvaluationResponse | null;
  onSelect: (selection: Selection) => void;
}

function riskColor(risk: number): string {
  if (risk >= 0.7) return "#dc493a";
  if (risk >= 0.45) return "#ec8f3a";
  if (risk >= 0.2) return "#e8c547";
  return "#31a37c";
}

export function GraphCanvas({ dataset, evaluation, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const risks = new Map(
      evaluation?.risks.map((record) => [record.id, record.risk]) ?? [],
    );
    const contributions = new Map(
      evaluation?.contributions.map((edge) => [
        `${edge.source}->${edge.target}`,
        edge.Q,
      ]) ?? [],
    );

    instanceRef.current?.destroy();
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...dataset.nodes.map((node) => {
          const risk = risks.get(node.id) ?? node.B;
          return {
            data: {
              id: node.id,
              label: node.label ?? node.id,
              risk,
              color: riskColor(risk),
              outlet: node.outlet ? "yes" : "no",
            },
          };
        }),
        ...dataset.edges.map((edge) => ({
          data: {
            id: `${edge.source}->${edge.target}`,
            source: edge.source,
            target: edge.target,
            contribution: contributions.get(`${edge.source}->${edge.target}`) ?? 0,
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            width: 42,
            height: 42,
            label: "data(label)",
            "font-family": "DM Sans, system-ui, sans-serif",
            "font-size": 11,
            "font-weight": 700,
            color: "#eaf0f6",
            "text-valign": "center",
            "text-halign": "center",
            "background-color": "data(color)",
            "border-width": 3,
            "border-color": "#f4f5f7",
            "overlay-opacity": 0,
          },
        },
        {
          selector: 'node[outlet = "yes"]',
          style: { shape: "diamond", "border-color": "#26292d" },
        },
        {
          selector: "edge",
          style: {
            width: "mapData(contribution, 0, 1, 1.5, 5)",
            "line-color": "#697581",
            "target-arrow-color": "#4f5b66",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.8,
            opacity: 0.82,
            "overlay-opacity": 0,
          },
        },
        {
          selector: ":selected",
          style: {
            "border-color": "#246fd6",
            "border-width": 4,
            "line-color": "#246fd6",
            "target-arrow-color": "#246fd6",
          },
        },
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        padding: 42,
        spacingFactor: dataset.nodes.length > 12 ? 1.15 : 1.45,
        circle: false,
      },
      minZoom: 0.35,
      maxZoom: 2.3,
    });

    cy.on("tap", "node", (event) => {
      onSelect({ type: "node", id: event.target.id() });
    });
    cy.on("tap", "edge", (event) => {
      onSelect({
        type: "edge",
        source: event.target.data("source"),
        target: event.target.data("target"),
      });
    });
    cy.on("tap", (event) => {
      if (event.target === cy) onSelect(null);
    });
    instanceRef.current = cy;

    return () => cy.destroy();
  }, [dataset, evaluation, onSelect]);

  return <div className="graph-canvas" ref={containerRef} />;
}
