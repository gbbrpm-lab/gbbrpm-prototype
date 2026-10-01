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
  selection: Selection;
  walkthrough?: {
    revealedNodes: Set<string>;
    revealedEdges: Set<string>;
    activeNodes: Set<string>;
    activeEdges: Set<string>;
    playing: boolean;
    reducedMotion: boolean;
  } | null;
}

function riskColor(risk: number): string {
  if (risk >= 0.7) return "#dc493a";
  if (risk >= 0.45) return "#ec8f3a";
  if (risk >= 0.2) return "#e8c547";
  return "#31a37c";
}

export function GraphCanvas({ dataset, evaluation, onSelect, selection, walkthrough }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Core | null>(null);
  const topologyKey = JSON.stringify([dataset.id, dataset.nodes.map((node) => node.id), dataset.edges.map((edge) => [edge.source, edge.target])]);
  const datasetRef = useRef(dataset);
  datasetRef.current = dataset;

  useEffect(() => {
    if (!containerRef.current) return;
    const dataset = datasetRef.current;

    instanceRef.current?.destroy();
    const transitionMs = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...dataset.nodes.map((node) => {
          const risk = node.B;
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
            contribution: 0,
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
            "transition-property": "background-color, border-color, opacity",
            "transition-duration": transitionMs,
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
            "transition-property": "line-color, target-arrow-color, opacity, width",
            "transition-duration": transitionMs,
          },
        },
        {
          selector: "node.pending",
          style: { "background-color": "#a2aab3", "border-color": "#c6ccd3", opacity: 0.6 },
        },
        {
          selector: "edge.pending",
          style: { opacity: 0.2 },
        },
        {
          selector: "edge.flow",
          style: { "line-style": "dashed", "line-dash-pattern": [8, 5] },
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
        {
          selector: "node.active-step",
          style: { "border-color": "#246fd6", "border-width": 6, opacity: 1 },
        },
        {
          selector: "edge.active-step",
          style: { "line-color": "#246fd6", "target-arrow-color": "#246fd6", "line-style": "dashed", "line-dash-pattern": [8, 5], width: 5, opacity: 1 },
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
  }, [topologyKey, onSelect]);

  useEffect(() => {
    const cy = instanceRef.current;
    if (!cy) return;
    const risks = new Map(evaluation?.risks.map((record) => [record.id, record.risk]) ?? []);
    const contributions = new Map(evaluation?.contributions.map((edge) => [`${edge.source}->${edge.target}`, edge.Q]) ?? []);
    cy.batch(() => {
      for (const node of dataset.nodes) {
        const element = cy.getElementById(node.id);
        const risk = risks.get(node.id) ?? node.B;
        element.data({ color: riskColor(risk), risk, label: node.label ?? node.id, outlet: node.outlet ? "yes" : "no" });
        element.toggleClass("pending", Boolean(walkthrough && !walkthrough.revealedNodes.has(node.id)));
        element.toggleClass("active-step", Boolean(walkthrough?.activeNodes.has(node.id)));
      }
      for (const edge of dataset.edges) {
        const id = `${edge.source}->${edge.target}`;
        const revealed = !walkthrough || walkthrough.revealedEdges.has(id);
        const flowing = Boolean(walkthrough && !walkthrough.reducedMotion &&
          (walkthrough.activeEdges.has(id) || walkthrough.revealedEdges.has(id)));
        cy.getElementById(id)
          .data("contribution", revealed ? contributions.get(id) ?? 0 : 0)
          .toggleClass("pending", !revealed)
          .toggleClass("active-step", Boolean(walkthrough?.activeEdges.has(id)))
          .toggleClass("flow", flowing);
      }
    });
  }, [topologyKey, dataset, evaluation, walkthrough]);

  useEffect(() => {
    const cy = instanceRef.current;
    if (!cy) return;
    cy.elements().unselect();
    if (!selection) return;
    const id = selection.type === "node" ? selection.id : `${selection.source}->${selection.target}`;
    const element = cy.getElementById(id);
    element.select();
    if (element.length && selection.type === "node") cy.center(element);
  }, [topologyKey, selection]);

  useEffect(() => {
    const cy = instanceRef.current;
    if (!cy || !walkthrough || walkthrough.reducedMotion) return;
    const edges = cy.edges(".flow");
    if (edges.length === 0) return;
    let frame = 0;
    const draw = (time: number) => {
      edges.style("line-dash-offset", -(time / 35) % 13);
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      edges.removeStyle("line-dash-offset");
    };
  }, [topologyKey, walkthrough]);

  return <div className="graph-canvas" ref={containerRef} />;
}
