import { useMemo, useState } from "react";
import { forceCollide, forceSimulation, forceX, forceY } from "d3";
import { useChart } from "./ChartContext";
import { bubbleRadii } from "./bubbleRadii";
import Tooltip from "./Tooltip";

// A "bubble stream": one dot per datum, placed along the x axis at its value and packed into a swarm
// so overlapping dots stack up and out from the middle line instead of covering each other. The
// vertical position carries no meaning; a dense stretch just looks thick. Dots are pulled toward
// their true x, not pinned to it, so a dot can sit a little off its exact spot (the hover tooltip
// gives the real value). Goes inside <Chart>; the x scale comes from the chart.
//
//   <Chart height={240} x={{ domain: [0, 3000] }}>
//     <BubbleStream data={kills} x={(k) => k.seconds} color={(k) => k.won ? "blue" : "tan"}
//       tooltip={({ datum }) => <div>...</div>} onPointClick={(k) => open(k)} />
//   </Chart>
//
// data           array of anything
// x              (d) => value on the chart's x scale
// radius         dot radius in px (the largest dot's radius when `size` is used); everything shrinks
//                automatically until the whole swarm fits the height
// size           (d) => number, to size dots by a value (points gained, say). Area follows the value, so
//                a dot twice the value has twice the area. A datum without a number gets the smallest dot.
// fluidWidth     plot width in px at and above which dots are full size; narrower plots scale the dots down
//                in proportion, so a squeezed chart keeps its clumps instead of filling solid
// minScale       the smallest that scaling goes (share of full size, default 0.35)
// minRadius      the smallest dot when `size` is used (default 45% of `radius`)
// sizeDomain     [low, high] the value range that maps onto minRadius..radius; defaults to the data's
//                own range. Pin it to keep sizes comparable between charts.
// color          a color string or (d) => color
// pull           0..1, how hard dots are drawn back to their true x (lower = looser, fuzzier clumps)
// bin            width in x-axis units (seconds, for a clock); when set, each dot's target snaps to the center
//                of its bin, so nearby dots share a column and a busy stretch piles into a tall stack. This
//                trades exact position for a clearer spike (the tooltip still has the real value)
// lift           0..1, how hard dots are drawn back to the middle line (lower = a dense stretch is free
//                to stack up and out, so spikes stand taller; higher = a flatter, tidier stream)
// dimmed         (d) => boolean, fades the dots it returns true for (to pair with a Highlight: dim whatever
//                is outside the highlighted region). Fading never moves a dot.
// tooltip        ({ datum }) => markup, shown above the hovered / tapped dot
// onPointClick   (datum) => void, on a mouse click (a tap on touch only selects the dot)
const MIN_RADIUS = 2.2;
const TICKS = 260;

function simulate(data, xOf, centerY, radii, scale, gap, pull, lift, width, snapPx) {
  const nodes = data.map((d, i) => {
    const r = radii[i] * scale;
    const raw = xOf(d);
    const at = snapPx > 0 ? (Math.floor(raw / snapPx) + 0.5) * snapPx : raw;
    const tx = Math.min(width - r, Math.max(r, at)); // keep a dot's target inside the plot
    return { d, r, tx, x: tx, y: centerY + ((i % 5) - 2) * 0.4 };
  });
  const sim = forceSimulation(nodes)
    .force("x", forceX((n) => n.tx).strength(pull))
    .force("y", forceY(centerY).strength(lift))
    .force("collide", forceCollide((n) => n.r + gap / 2).iterations(2))
    .stop();
  for (let i = 0; i < TICKS; i += 1) sim.tick();
  return nodes;
}

export default function BubbleStream({ data, x, radius: fullRadius = 6, size, minRadius: fullMinRadius = fullRadius * 0.45, fluidWidth, minScale = 0.35, sizeDomain, color = "currentColor", gap = 1.2, pull = 0.4, lift = 0.015, bin = 0, dimmed, tooltip, onPointClick, className }) {
  const chart = useChart();
  const { innerWidth, innerHeight } = chart;
  const [active, setActive] = useState(-1);
  const fluid = fluidWidth && innerWidth ? Math.min(1, Math.max(minScale, innerWidth / fluidWidth)) : 1;
  const radius = fullRadius * fluid;
  const minRadius = fullMinRadius * fluid;

  const nodes = useMemo(() => {
    if (!innerWidth || !innerHeight || !data.length) return [];
    const xOf = (d) => chart.x(x(d));
    const half = innerHeight / 2;
    const snapPx = bin > 0 ? Math.abs(chart.x(bin) - chart.x(0)) : 0;
    const radii = bubbleRadii(data, size, radius, minRadius, sizeDomain);
    const biggest = Math.max(...radii);
    let scale = 1;
    let laid = simulate(data, xOf, half, radii, scale, gap, pull, lift, innerWidth, snapPx);
    // shrink everything together until the swarm fits (or the biggest dot is as small as allowed)
    const spread = (list) => Math.max(...list.map((n) => Math.abs(n.y - half) + n.r));
    while (biggest * scale > MIN_RADIUS && spread(laid) > half) {
      scale *= 0.88;
      laid = simulate(data, xOf, half, radii, scale, gap, pull, lift, innerWidth, snapPx);
    }
    laid.forEach((n) => { n.x = Math.min(innerWidth - n.r, Math.max(n.r, n.x)); });
    return laid;
  }, [data, x, size, chart.x, innerWidth, innerHeight, radius, minRadius, sizeDomain, gap, pull, lift, bin]); // eslint-disable-line react-hooks/exhaustive-deps

  const colorOf = (d) => (typeof color === "function" ? color(d) : color);
  const shown = nodes[active];

  return (
    <>
      <g className={`chart-bubbles${className ? ` ${className}` : ""}`}>
        {nodes.map((n, i) => (
          <circle
            key={i}
            className={`chart-bubbles__dot${i === active ? " chart-bubbles__dot--active" : ""}${dimmed && dimmed(n.d) ? " chart-bubbles__dot--dim" : ""}`}
            cx={n.x}
            cy={n.y}
            r={i === active ? n.r + 1.5 : n.r}
            fill={colorOf(n.d)}
            style={onPointClick ? { cursor: "pointer" } : undefined}
            onPointerEnter={(e) => { if (e.pointerType === "mouse") setActive(i); }}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(-1); }}
            onPointerUp={(e) => { if (e.pointerType !== "mouse") setActive(i === active ? -1 : i); }}
            onClick={(e) => { if (onPointClick && e.detail > 0 && e.nativeEvent.pointerType !== "touch") onPointClick(n.d); }}
          />
        ))}
      </g>
      {tooltip && shown && <Tooltip x={shown.x} y={shown.y - shown.r - 4}>{tooltip({ datum: shown.d })}</Tooltip>}
    </>
  );
}
