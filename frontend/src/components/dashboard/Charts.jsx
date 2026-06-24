import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

const CHART_COLORS = {
  blue: "#2455FF",
  cyan: "#00E5FF",
  violet: "#8B5CF6",
  emerald: "#10B981",
  rose: "#F43F5E",
  slate: "#475569"
};

const PIE_COLORS = [CHART_COLORS.blue, CHART_COLORS.cyan, CHART_COLORS.violet, CHART_COLORS.emerald, CHART_COLORS.rose];

// Custom Tooltip component for light mode styling
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-[#2455ff]/15 bg-white/95 p-3 shadow-xl backdrop-blur-md">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</p>
        {payload.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 mt-0.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
            <span className="font-sans text-xs font-semibold text-[#050a1a]">
              {item.name}: {typeof item.value === "number" && item.value > 1000 ? `₹${item.value.toLocaleString()}` : item.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function RevenueChart({ data = [] }) {
  const chartData = data.length > 0 ? data : [
    { name: "Jan", Revenue: 24000 },
    { name: "Feb", Revenue: 35000 },
    { name: "Mar", Revenue: 48000 },
    { name: "Apr", Revenue: 62000 },
    { name: "May", Revenue: 75000 },
    { name: "Jun", Revenue: 95000 }
  ];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0.0}/>
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2455ff" strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            fontSize={10}
            fontFamily="IBM Plex Mono"
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={10}
            fontFamily="IBM Plex Mono"
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `₹${val / 1000}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="Revenue"
            name="Revenue"
            stroke={CHART_COLORS.blue}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProjectStatusChart({ data = [] }) {
  const chartData = data.length > 0 ? data : [
    { name: "Intake", value: 3 },
    { name: "Active", value: 7 },
    { name: "Paused", value: 2 },
    { name: "Closed", value: 4 }
  ];

  return (
    <div className="h-64 w-full flex flex-col items-center justify-center">
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={4}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-2">
        {chartData.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
            <span>{entry.name} ({entry.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaskDistributionChart({ data = [] }) {
  const chartData = data.length > 0 ? data : [
    { name: "To Do", Tasks: 8 },
    { name: "In Progress", Tasks: 12 },
    { name: "In Review", Tasks: 5 },
    { name: "Completed", Tasks: 15 }
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#2455ff" strokeDasharray="3 3" strokeOpacity={0.06} vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            fontSize={10}
            fontFamily="IBM Plex Mono"
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={10}
            fontFamily="IBM Plex Mono"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="Tasks" name="Tasks Count" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index % 2 === 0 ? CHART_COLORS.blue : CHART_COLORS.violet}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
