
import React, { useMemo } from 'react';
import { Candidate, CandidateStatus } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { Users, Star, Target, Zap, TrendingUp, MousePointerClick } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardStatsProps {
  candidates: Candidate[];
  onFilterClick: (type: 'source' | 'role' | 'topTalent', value: string | boolean) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#0ea5e9', '#d946ef'];

const DashboardStats: React.FC<DashboardStatsProps> = ({ candidates, onFilterClick }) => {
  const { t } = useLanguage();
  const total = candidates.length;

  const normalize = (val: number) => (val > 10 ? val / 10 : val);

  // 1. Top Talent: Score >= 8.0
  const topTalentCount = candidates.filter(c => normalize(c.analysis?.matchScore || 0) >= 8).length;

  // 2. Avg Score
  const totalScore = candidates.reduce((sum, c) => sum + normalize(c.analysis?.matchScore || 0), 0);
  const avgScore = total > 0 ? (totalScore / total).toFixed(1) : '0';

  // 3. Culture Fit (Try to find V4 match or fallback)
  const totalCulture = candidates.reduce((sum, c) => {
      // V4 doesn't have explicit "Culture", we can use (A) Industry or (E) Future as proxy, 
      // or just keep using matchScore if specific dimension is missing.
      // For dashboard consistency, let's look for "(E) 未來就緒度" as a proxy for "Soft Skills/Culture" in V4 Context
      // Or fallback to matchScore.
      let val = 0;
      const dims = c.analysis?.scoringDimensions || {};
      const dimE = Object.entries(dims).find(([k]) => k.startsWith('(E)'));
      
      if (dimE) {
          val = dimE[1] as number;
      } else {
          // Legacy Fallback
          val = c.analysis?.fiveForces?.cultureFit || 0;
      }
      return sum + normalize(val);
  }, 0);
  const avgCulture = total > 0 ? (totalCulture / total).toFixed(1) : '0';

  // 4. Pending Action
  const pendingCount = candidates.filter(c => c.status === CandidateStatus.NEW || c.status === CandidateStatus.SCREENING).length;

  // --- RADAR DATA (STRICT V4 ONLY) ---
  const radarData = useMemo(() => {
    // Explicitly define the 5 buckets we want
    const v4Buckets = [
        { prefix: '(A)', fullLabel: '(A) 產業相關性', sum: 0, count: 0 },
        { prefix: '(B)', fullLabel: '(B) 系統導入經驗', sum: 0, count: 0 },
        { prefix: '(C)', fullLabel: '(C) 專案管理經驗', sum: 0, count: 0 },
        { prefix: '(D)', fullLabel: '(D) 技術量化成效', sum: 0, count: 0 },
        { prefix: '(E)', fullLabel: '(E) 未來就緒度', sum: 0, count: 0 },
    ];

    candidates.forEach(c => {
        // Support both scoringDimensions object and dimensionDetails array
        const dimsObj = c.analysis?.scoringDimensions || {};
        const dimsArr = c.analysis?.dimensionDetails || [];

        // Helper to find score for a prefix (e.g. "(A)")
        const getScore = (prefix: string) => {
            // 1. Try Map
            const mapEntry = Object.entries(dimsObj).find(([k]) => k.startsWith(prefix));
            if (mapEntry) return normalize(mapEntry[1] as number);
            
            // 2. Try Array
            const arrEntry = dimsArr.find(d => d.dimension.startsWith(prefix));
            if (arrEntry) return normalize(arrEntry.score);

            return null;
        };

        v4Buckets.forEach(bucket => {
            const score = getScore(bucket.prefix);
            if (score !== null) {
                bucket.sum += score;
                bucket.count++;
            }
        });
    });

    return v4Buckets.map(b => ({
        // Smart Truncate: "(A) 產業相關性" -> "(A) 產業.."
        subject: b.fullLabel.length > 7 ? b.fullLabel.substring(0, 7) + '..' : b.fullLabel,
        fullSubject: b.fullLabel,
        A: b.count > 0 ? (b.sum / b.count).toFixed(1) : 0,
        fullMark: 10
    }));
  }, [candidates]);

  // Chart 2: Source Distribution (NORMALIZED)
  const sourceMap: Record<string, number> = {};
  
  const normalizeSource = (rawSource: string) => {
      const lower = (rawSource || '').toLowerCase().trim();
      if (lower.includes('104')) return '104 Corp';
      if (lower.includes('linkedin')) return 'LinkedIn';
      if (lower.includes('resume') || lower.includes('pdf') || lower.includes('upload') || lower.includes('user')) return 'User Upload';
      if (lower.includes('teamdoor')) return 'Teamdoor';
      return rawSource || 'Other';
  };

  candidates.forEach(c => {
    const normalizedName = normalizeSource(c.source);
    sourceMap[normalizedName] = (sourceMap[normalizedName] || 0) + 1;
  });
  
  const sourceData = Object.entries(sourceMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Chart 3: Role Distribution
  const roleMap: Record<string, number> = {};
  candidates.forEach(c => {
      const role = c.roleApplied || 'Unknown';
      roleMap[role] = (roleMap[role] || 0) + 1;
  });
  const roleData = Object.entries(roleMap).map(([name, count]) => ({ name, count }));

  // Custom Tooltip for Radar to show FULL name
  const CustomRadarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload; // Access the full object
      return (
        <div className="bg-slate-800 text-white text-xs p-2 rounded shadow-xl border border-slate-700 z-50">
          <p className="font-bold mb-1">{dataPoint.fullSubject || label}</p>
          <p className="text-emerald-400 font-mono">Avg: {payload[0].value} / 10</p>
        </div>
      );
    }
    return null;
  };

  const StatCard = ({ title, value, icon: Icon, color, subtext, onClick, highlight }: any) => (
    <div 
        onClick={onClick}
        className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all duration-200 group relative overflow-hidden
        ${onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-md hover:scale-[1.02]' : 'cursor-default'}
        ${highlight ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}
        `}
    >
      <div className={`p-4 rounded-xl ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-colors z-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div className="z-10">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
            {title}
            {onClick && <MousePointerClick className="w-3 h-3 text-slate-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
        </p>
        <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-800 mt-1">{value}</h3>
            {subtext && <span className="text-xs text-slate-400 font-medium">{subtext}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('kpiTopTalent')} value={topTalentCount} icon={Star} color="bg-emerald-500" subtext="High Potential" onClick={() => onFilterClick('topTalent', true)} highlight={true} />
        <StatCard title={t('kpiAvgScore')} value={avgScore} icon={TrendingUp} color="bg-blue-600" subtext="/ 10.0" />
        <StatCard title={t('kpiCulture')} value={avgCulture} icon={Users} color="bg-purple-600" subtext="(E) Future Fit" />
        <StatCard title={t('kpiAction')} value={pendingCount} icon={Zap} color="bg-amber-500" subtext="To Review" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar */}
        <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
           <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2 px-2"><Target className="w-4 h-4 text-blue-500" />{t('chartRadarTitle')}</h3>
           <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                  <PolarGrid gridType="polygon" stroke="#cbd5e1" strokeWidth={1} />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                  />
                  <PolarRadiusAxis 
                      angle={30} 
                      domain={[0, 10]} 
                      tickCount={6} 
                      tick={{ fill: '#94a3b8', fontSize: 9 }} 
                      axisLine={false} 
                  />
                  <Radar name="Pool Avg" dataKey="A" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.3} />
                  <Tooltip content={<CustomRadarTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                </RadarChart>
              </ResponsiveContainer>
              <div className="absolute bottom-2 w-full text-center"><span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">Benchmark: V4</span></div>
           </div>
        </div>

        {/* Roles */}
        <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2 px-2"><Users className="w-4 h-4 text-emerald-500" />{t('chartRoleTitle')}</h3>
          <div className="flex-1 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={110} 
                        tick={{fill: '#64748b', fontSize: 10, fontWeight: 600}} 
                        tickFormatter={(val) => val.length > 18 ? val.substring(0, 18) + '...' : val} 
                    />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20} onClick={(data: any) => { const r = data.name || (data.payload && data.payload.name); if(r) onFilterClick('role', r); }}>
                        {roleData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source */}
        <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2 px-2"><TrendingUp className="w-4 h-4 text-amber-500" />{t('chartSourceTitle')}</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie 
                      data={sourceData} 
                      cx="50%" 
                      cy="45%" 
                      innerRadius={60} 
                      outerRadius={80} 
                      paddingAngle={5} 
                      dataKey="value" 
                      onClick={(data) => { 
                          if(data && data.name) onFilterClick('source', data.name === 'User Upload' ? 'All' : data.name); 
                      }}
                    >
                        {sourceData.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={entry.name === '104 Corp' ? '#ff7800' : (entry.name === 'LinkedIn' ? '#0a66c2' : COLORS[i % COLORS.length])} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px'}} />
                </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
