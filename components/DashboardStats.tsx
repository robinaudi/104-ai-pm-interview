
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];

const DashboardStats: React.FC<DashboardStatsProps> = ({ candidates, onFilterClick }) => {
  const { t } = useLanguage();
  const total = candidates.length;

  const normalize = (val: number) => (val > 10 ? val / 10 : val);

  // 1. Top Talent: Score >= 8.0
  const topTalentCount = candidates.filter(c => normalize(c.analysis?.matchScore || 0) >= 8).length;

  // 2. Avg Score
  const totalScore = candidates.reduce((sum, c) => sum + normalize(c.analysis?.matchScore || 0), 0);
  const avgScore = total > 0 ? (totalScore / total).toFixed(1) : '0';

  // 3. Culture Fit
  const totalCulture = candidates.reduce((sum, c) => sum + normalize(c.analysis?.fiveForces?.cultureFit || 0), 0);
  const avgCulture = total > 0 ? (totalCulture / total).toFixed(1) : '0';

  // 4. Pending Action
  const pendingCount = candidates.filter(c => c.status === CandidateStatus.NEW || c.status === CandidateStatus.SCREENING).length;

  // Radar Data
  const radarData = useMemo(() => {
    if (total === 0) return [];
    
    const sums = candidates.reduce((acc, c) => {
        const f = c.analysis?.fiveForces;
        if (!f) return acc;
        return {
            competency: acc.competency + normalize(f.competency),
            experience: acc.experience + normalize(f.experience),
            cultureFit: acc.cultureFit + normalize(f.cultureFit),
            potential: acc.potential + normalize(f.potential),
            communication: acc.communication + normalize(f.communication),
        };
    }, { competency: 0, experience: 0, cultureFit: 0, potential: 0, communication: 0 });

    return [
        { subject: 'Competency', A: (sums.competency / total).toFixed(1), fullMark: 10 },
        { subject: 'Experience', A: (sums.experience / total).toFixed(1), fullMark: 10 },
        { subject: 'Culture Fit', A: (sums.cultureFit / total).toFixed(1), fullMark: 10 },
        { subject: 'Potential', A: (sums.potential / total).toFixed(1), fullMark: 10 },
        { subject: 'Communication', A: (sums.communication / total).toFixed(1), fullMark: 10 },
    ];
  }, [candidates, total]);

  // Chart 2: Source Distribution
  const sourceMap: Record<string, number> = {};
  candidates.forEach(c => {
    sourceMap[c.source] = (sourceMap[c.source] || 0) + 1;
  });
  const sourceData = Object.entries(sourceMap).map(([name, value]) => ({ name, value }));

  // Chart 3: Role Distribution
  const roleMap: Record<string, number> = {};
  candidates.forEach(c => {
      const role = c.roleApplied || 'Unknown';
      roleMap[role] = (roleMap[role] || 0) + 1;
  });
  const roleData = Object.entries(roleMap).map(([name, count]) => ({ name, count }));

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
        <StatCard title={t('kpiCulture')} value={avgCulture} icon={Users} color="bg-purple-600" subtext="/ 10.0" />
        <StatCard title={t('kpiAction')} value={pendingCount} icon={Zap} color="bg-amber-500" subtext="To Review" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
           <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-blue-500" />{t('chartRadarTitle')}</h3>
           <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                  <Radar name="Pool Avg" dataKey="A" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.2} />
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="absolute bottom-0 w-full text-center"><span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">Scale: 0 - 10</span></div>
           </div>
        </div>

        {/* Roles */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" />{t('chartRoleTitle')}</h3>
          <div className="flex-1 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fill: '#64748b', fontSize: 11, fontWeight: 500}} tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24} onClick={(data: any) => { const r = data.name || (data.payload && data.payload.name); if(r) onFilterClick('role', r); }}>
                        {roleData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-500" />{t('chartSourceTitle')}</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={sourceData} cx="50%" cy="45%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" onClick={(data) => { if(data && data.name) onFilterClick('source', data.name); }}>
                        {sourceData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
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
