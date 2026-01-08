
import React, { useState, useMemo } from 'react';
import { Candidate, CandidateStatus, SourceType, User } from '../types';
import { Trash2, ChevronRight, Search, X, Globe, Briefcase, Filter, Sparkles, Star, RefreshCw, Zap, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CandidateTableProps {
  candidates: Candidate[];
  onSelect: (candidate: Candidate) => void;
  onDelete: (id: string) => void;
  currentUser: User;
  externalFilterSource: string;
  externalFilterRole: string;
  externalFilterTopTalent: boolean;
  onFilterSourceChange: (source: string) => void;
  onFilterRoleChange: (role: string) => void;
  onToggleTopTalent: (enabled: boolean) => void;
  onClearFilters: () => void;
}

type SortKey = 'name' | 'roleApplied' | 'status' | 'source' | 'createdAt' | 'score';
type SortDirection = 'asc' | 'desc';

const CandidateTable: React.FC<CandidateTableProps> = ({ 
    candidates, 
    onSelect, 
    onDelete,
    currentUser,
    externalFilterSource,
    externalFilterRole,
    externalFilterTopTalent,
    onFilterSourceChange,
    onFilterRoleChange,
    onToggleTopTalent,
    onClearFilters
}) => {
  const { t } = useLanguage();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'createdAt',
    direction: 'desc',
  });
  
  // Dynamic Option Generation
  const uniqueRoles = useMemo(() => {
    const roles = new Set(candidates.map(c => c.roleApplied).filter(Boolean));
    return Array.from(roles).sort();
  }, [candidates]);

  const uniqueSources = useMemo(() => {
    const sources = new Set(candidates.map(c => c.source).filter(Boolean));
    return Array.from(sources).sort();
  }, [candidates]);

  // Robust Score Normalizer (Fixes crash on strings/nulls)
  const getNormalizedScore = (c: Candidate) => {
      let score: any = c.analysis?.matchScore;
      
      // Fallback to skillsMatch if matchScore missing
      if (score === undefined || score === null) {
          score = c.analysis?.fiveForces?.skillsMatch;
      }

      // Force Number type
      const numScore = Number(score);
      if (isNaN(numScore)) return 0;

      return numScore > 10 ? numScore / 10 : numScore;
  };

  const processedCandidates = useMemo(() => {
    // 1. Filter
    let filtered = candidates.filter(c => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        c.name.toLowerCase().includes(searchLower) || 
        c.email.toLowerCase().includes(searchLower) ||
        (c.analysis?.extractedData?.englishName && c.analysis.extractedData.englishName.toLowerCase().includes(searchLower));
      
      const matchesSource = externalFilterSource === 'All' || c.source === externalFilterSource;
      const matchesRole = externalFilterRole === 'All' || c.roleApplied === externalFilterRole;
      const matchesTopTalent = externalFilterTopTalent ? getNormalizedScore(c) >= 8 : true;

      return matchesSearch && matchesSource && matchesRole && matchesTopTalent;
    });

    // 2. Sort
    return filtered.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any, valB: any;

      switch (key) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'roleApplied':
          valA = a.roleApplied.toLowerCase();
          valB = b.roleApplied.toLowerCase();
          break;
        case 'status':
          valA = a.status.toLowerCase();
          valB = b.status.toLowerCase();
          break;
        case 'source':
          valA = a.source.toLowerCase();
          valB = b.source.toLowerCase();
          break;
        case 'createdAt':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
        case 'score':
          valA = getNormalizedScore(a);
          valB = getNormalizedScore(b);
          break;
        default:
          return 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [candidates, searchQuery, externalFilterSource, externalFilterRole, externalFilterTopTalent, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      // Defaults: Newest Date first, Highest Score first. Others A-Z.
      const defaultDirection = (key === 'createdAt' || key === 'score') ? 'desc' : 'asc';
      return { key, direction: defaultDirection };
    });
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-50 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-600" /> 
      : <ArrowDown className="w-3 h-3 text-blue-600" />;
  };

  const getStatusColor = (status: CandidateStatus) => {
    switch(status) {
      case CandidateStatus.NEW: return 'bg-blue-100 text-blue-700 border-blue-200';
      case CandidateStatus.INTERVIEW: return 'bg-purple-100 text-purple-700 border-purple-200';
      case CandidateStatus.OFFER: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case CandidateStatus.REJECTED: return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getSourceBadge = (source: string) => {
    if (source.includes('LinkedIn')) return <span className="text-[#0a66c2] font-bold flex items-center gap-1.5"><Globe className="w-3.5 h-3.5"/> LinkedIn</span>;
    if (source.includes('104')) return <span className="text-[#ff7800] font-bold flex items-center gap-1.5"><Globe className="w-3.5 h-3.5"/> 104 Corp</span>;
    if (source.includes('Teamdoor')) return <span className="text-[#00b0ff] font-bold flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5"/> Teamdoor</span>;
    return <span className="text-slate-500 font-medium flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5"/> {source}</span>;
  };

  const getAvatar = (c: Candidate) => {
    if (c.photoUrl) return c.photoUrl;
    let avatarName = c.name;
    if (c.analysis?.extractedData?.englishName && c.analysis.extractedData.englishName !== 'Unknown') {
        avatarName = c.analysis.extractedData.englishName;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=random&size=40&bold=true`;
  };

  const formatDate = (dateString: string) => {
      try {
          return new Date(dateString).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
      } catch (e) { return dateString; }
  };

  const hasActiveFilters = externalFilterSource !== 'All' || externalFilterRole !== 'All' || externalFilterTopTalent || searchQuery;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* --- INTELLIGENT SEARCH TOOLBAR --- */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between sticky top-20 z-20">
        
        {/* Left: Text Search */}
        <div className="relative w-full md:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, Email, ID..."
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all shadow-inner"
            />
        </div>

        {/* Right: Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            
            {/* AI Top Talent Toggle */}
            <button
                onClick={() => onToggleTopTalent(!externalFilterTopTalent)}
                className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm border
                    ${externalFilterTopTalent 
                        ? 'bg-amber-50 text-amber-700 border-amber-200 ring-2 ring-amber-100 shadow-amber-100' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-600'}
                `}
            >
                {externalFilterTopTalent ? <Star className="w-4 h-4 fill-amber-500 text-amber-500 animate-pulse" /> : <Sparkles className="w-4 h-4" />}
                {t('kpiTopTalent')}
            </button>
            
            <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block"></div>

            {/* Source Filter */}
            <div className="relative">
                <select
                    value={externalFilterSource}
                    onChange={(e) => onFilterSourceChange(e.target.value)}
                    className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-4 pr-10 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-300 transition-colors cursor-pointer"
                >
                    <option value="All">All Sources</option>
                    {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <Filter className="w-3 h-3 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>

            {/* Role Filter */}
            <div className="relative">
                <select
                    value={externalFilterRole}
                    onChange={(e) => onFilterRoleChange(e.target.value)}
                    className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-4 pr-10 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-300 transition-colors cursor-pointer max-w-[200px]"
                >
                    <option value="All">All Roles</option>
                    {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <Briefcase className="w-3 h-3 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>

            {/* Reset */}
            {hasActiveFilters && (
                <button 
                    onClick={() => { setSearchQuery(''); onClearFilters(); }}
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Clear Filters"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            )}
        </div>
      </div>
      
      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {processedCandidates.length === 0 ? (
             <div className="p-12 text-center flex flex-col items-center">
                 <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                     <Search className="w-8 h-8 text-slate-300" />
                 </div>
                 <h3 className="text-lg font-bold text-slate-800">No candidates found</h3>
                 <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters.</p>
                 <button onClick={onClearFilters} className="mt-4 text-blue-600 font-bold text-sm hover:underline">Clear all filters</button>
             </div>
        ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 select-none">
                    <th className="px-6 py-4 pl-8 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-2">{t('candidate')} <SortIcon column="name" /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('roleApplied')}>
                        <div className="flex items-center gap-2">{t('appliedRole')} <SortIcon column="roleApplied" /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('status')}>
                        <div className="flex items-center gap-2">{t('status')} <SortIcon column="status" /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('source')}>
                        <div className="flex items-center gap-2">{t('source')} <SortIcon column="source" /></div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('createdAt')}>
                        <div className="flex items-center gap-2">{t('uploadedInfo')} <SortIcon column="createdAt" /></div>
                    </th> 
                    <th className="px-6 py-4 w-32 cursor-pointer hover:bg-slate-100 group transition-colors" onClick={() => handleSort('score')}>
                        <div className="flex items-center gap-2">{t('aiScore')} <SortIcon column="score" /></div>
                    </th>
                    <th className="px-6 py-4 text-right pr-8">{t('actions')}</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {processedCandidates.map(c => {
                    const avatarUrl = getAvatar(c);
                    const hasRead = c.viewedBy && c.viewedBy.includes(currentUser.email);
                    const score = getNormalizedScore(c);

                    return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group cursor-pointer relative" onClick={() => onSelect(c)}>
                    <td className="px-6 py-4 pl-8 relative">
                        {hasRead && <div className="absolute top-2 left-2 bg-slate-100 text-[9px] text-slate-400 font-bold px-1.5 py-0.5 rounded border border-slate-200">READ</div>}
                        <div className="flex items-center gap-3">
                        <div className="relative">
                            <img src={avatarUrl} alt={c.name} className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
                            {score >= 8 && <div className="absolute -top-1 -right-1 bg-amber-400 text-white rounded-full p-0.5 border-2 border-white"><Star className="w-2 h-2 fill-white" /></div>}
                            {c.isUnsolicited && <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5 border-2 border-white" title="Active Applicant"><Zap className="w-2 h-2 fill-white" /></div>}
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                {c.name}
                                {c.isUnsolicited && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded border border-indigo-200 font-bold">ACTIVE</span>}
                            </div>
                            <div className="text-xs text-slate-500">{c.email}</div>
                        </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-bold">{c.roleApplied}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusColor(c.status)}`}>{c.status}</span>
                    </td>
                    <td className="px-6 py-4 text-sm">{getSourceBadge(c.source)}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                        <div className="font-medium text-slate-700">{formatDate(c.createdAt).split(' ')[0]}</div>
                        <div className="text-[10px] opacity-70">{formatDate(c.createdAt).split(' ')[1]}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden w-full border border-slate-200">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${score >= 8 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : score >= 6 ? 'bg-blue-500' : 'bg-red-400'}`}
                                    style={{ width: `${score * 10}%` }} 
                                />
                            </div>
                            <span className={`text-sm font-bold w-8 text-right ${score >= 8 ? 'text-emerald-600' : 'text-slate-600'}`}>{score.toFixed(1)}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right pr-8">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="p-2 text-slate-300">
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </div>
                    </td>
                    </tr>
                )})}
                </tbody>
            </table>
            </div>
        )}
      </div>
      <div className="text-center text-xs text-slate-400 mt-2">
          Showing {processedCandidates.length} candidate{processedCandidates.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default CandidateTable;
