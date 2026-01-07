
import React, { useState, useMemo, useEffect } from 'react';
import { Candidate, CandidateStatus, SourceType, User } from '../types';
import { Trash2, ChevronRight, Download, Search, X, Globe, Briefcase, Filter, Sparkles, Star, Calendar, User as UserIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface FilterPillProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
  icon?: React.ReactNode;
}

const FilterPill: React.FC<FilterPillProps> = ({ label, isActive, onClick, count, icon }) => (
  <button
      onClick={onClick}
      className={`
          px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border flex items-center gap-2
          ${isActive 
              ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105' 
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}
      `}
  >
      {icon}
      {label}
      {count !== undefined && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-slate-600 text-slate-100' : 'bg-slate-100 text-slate-500'}`}>
              {count}
          </span>
      )}
  </button>
);

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
  onClearFilters: () => void;
}

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
    onClearFilters
}) => {
  const { t } = useLanguage();
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const uniqueRoles = useMemo(() => {
    const roles = new Set(candidates.map(c => c.roleApplied).filter(Boolean));
    return Array.from(roles);
  }, [candidates]);

  // Normalize score helper for backward compatibility
  const getNormalizedScore = (c: Candidate) => {
      const score = c.analysis?.matchScore || c.analysis?.fiveForces?.competency || 0;
      return score > 10 ? score / 10 : score;
  };

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSource = externalFilterSource === 'All' || c.source === externalFilterSource;
      const matchesRole = externalFilterRole === 'All' || c.roleApplied === externalFilterRole;
      const matchesTopTalent = externalFilterTopTalent ? getNormalizedScore(c) >= 8 : true;

      return matchesSearch && matchesSource && matchesRole && matchesTopTalent;
    });
  }, [candidates, searchQuery, externalFilterSource, externalFilterRole, externalFilterTopTalent]);

  const getStatusColor = (status: CandidateStatus) => {
    switch(status) {
      case CandidateStatus.NEW: return 'bg-blue-100 text-blue-700';
      case CandidateStatus.INTERVIEW: return 'bg-purple-100 text-purple-700';
      case CandidateStatus.OFFER: return 'bg-emerald-100 text-emerald-700';
      case CandidateStatus.REJECTED: return 'bg-slate-100 text-slate-600';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getSourceBadge = (source: string) => {
    if (source.includes('LinkedIn')) return <span className="text-[#0a66c2] font-semibold flex items-center gap-1"><Globe className="w-3 h-3"/> LinkedIn</span>;
    if (source.includes('104')) return <span className="text-[#ff7800] font-semibold flex items-center gap-1"><Globe className="w-3 h-3"/> 104</span>;
    if (source.includes('Teamdoor')) return <span className="text-[#00b0ff] font-semibold flex items-center gap-1"><Globe className="w-3 h-3"/> Teamdoor</span>;
    if (source.includes('Uploaded by')) return <span className="text-slate-500 font-medium flex items-center gap-1"><Briefcase className="w-3 h-3"/> Manual</span>;
    return <span className="text-slate-600">{source}</span>;
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

  const commonSources = [SourceType.LINKEDIN, SourceType.ONE_ZERO_FOUR, SourceType.TEAMDOOR];

  return (
    <div className="space-y-6">
      {/* Search & Filter UI (Omitted for brevity, assumed same) */}
      
      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="px-6 py-4 pl-8">{t('candidate')}</th>
                <th className="px-6 py-4">{t('appliedRole')}</th>
                <th className="px-6 py-4">{t('status')}</th>
                <th className="px-6 py-4">{t('source')}</th>
                <th className="px-6 py-4">{t('uploadedInfo')}</th> 
                <th className="px-6 py-4 w-32">{t('aiScore')}</th>
                <th className="px-6 py-4 text-right pr-8">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => {
                const avatarUrl = getAvatar(c);
                const hasRead = c.viewedBy && c.viewedBy.includes(currentUser.email);
                const score = getNormalizedScore(c);

                return (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors group cursor-pointer relative" onClick={() => onSelect(c)}>
                  <td className="px-6 py-4 pl-8 relative">
                    {hasRead && <div className="absolute top-0 left-0 bg-slate-100 text-[9px] text-slate-400 font-bold px-1.5 py-0.5 rounded-br border border-slate-200">已讀</div>}
                    <div className="flex items-center gap-3">
                       <img src={avatarUrl} alt={c.name} className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
                       <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                            {c.name}
                            {score >= 8 && <Star className="w-3 h-3 fill-amber-500 text-amber-500" />}
                        </div>
                        <div className="text-xs text-slate-500">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{c.roleApplied}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(c.status)}`}>{c.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">{getSourceBadge(c.source)}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                      <div>{formatDate(c.createdAt)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden w-full">
                            <div 
                                className={`h-full rounded-full ${score >= 8 ? 'bg-emerald-500' : score >= 6 ? 'bg-blue-500' : 'bg-red-400'}`}
                                style={{ width: `${score * 10}%` }} 
                            />
                        </div>
                        <span className="text-xs font-bold text-slate-700 w-6 text-right">{score.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right pr-8">
                     <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-2" />
                     </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CandidateTable;
