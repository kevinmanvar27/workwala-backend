const fs = require('fs');
const svg = fs.readFileSync('public/world-map.svg', 'utf8');

let reactCode = svg
  .replace(/xmlns:amcharts="[^"]*"/, '')
  .replace(/xmlns:xlink="[^"]*"/, '')
  .replace(/<amcharts:ammap[^>]*><\/amcharts:ammap>/, '')
  .replace(/xml:space="preserve"/g, '')
  .replace(/class="land"/g, 'className="land"')
  .replace(/class="land has-data"/g, 'className="land"')
  .replace(/style="[^"]*"/g, ''); // remove inline styles

const componentCode = `
'use client';
import { useState } from 'react';

export default function WorldMap({ data, primaryColor }: { data: { code: string; count: number; country: string }[], primaryColor: string }) {
  const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string } | null>(null);

  // Map counts to fill opacities
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const dataMap = new Map(data.map(d => [d.code, d.count]));

  const handleMouseEnter = (e: React.MouseEvent<SVGPathElement>, id: string, title: string) => {
    const count = dataMap.get(id) || 0;
    setTooltip({
      x: e.clientX,
      y: e.clientY - 40,
      text: \`\${title}: \${count} visitors\`
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGPathElement>) => {
    setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY - 40 } : null);
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="relative w-full h-full">
      ${reactCode.replace(/<svg /, '<svg className="w-full h-full" ').replace(/<path\s+id="([^"]+)"\s+title="([^"]+)"\s+className="land"\s+d="([^"]+)"\s*><\/path>/g, (match, id, title, d) => {
        return `{/* ${id} */}
        <path
          id="${id}"
          title="${title}"
          d="${d}"
          className="transition-colors duration-300 stroke-[#e5e7eb] stroke-[0.5] cursor-pointer hover:stroke-gray-500 hover:stroke-1"
          style={{
            fill: dataMap.has("${id}") ? primaryColor : '#f3f4f6',
            fillOpacity: dataMap.has("${id}") ? 0.3 + (0.7 * (dataMap.get("${id}")! / maxCount)) : 1,
          }}
          onMouseEnter={(e) => handleMouseEnter(e, "${id}", "${title}")}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />`;
      })}
      
      {tooltip && (
        <div 
          className="fixed z-50 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded shadow-lg pointer-events-none transform -translate-x-1/2 whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
`;

fs.mkdirSync('src/components/admin', { recursive: true });
fs.writeFileSync('src/components/admin/WorldMap.tsx', componentCode);
console.log('Component created successfully!');
