import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Download, 
  Trash2, 
  Filter, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  X
} from 'lucide-react';
import { Visitor } from '../types';
import { apiFetch } from '../api';

export const AccessHistoryView: React.FC = () => {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pages, setPages] = useState<number>(1);
  const [searchName, setSearchName] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);

  const fetchVisitors = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '15',
      });
      if (searchName.trim()) params.append('name', searchName.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await apiFetch<{ visitors: Visitor[]; total: number; pages: number }>(`/api/visitors?${params.toString()}`);
      if (res.ok && res.data) {
        setVisitors(res.data.visitors || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
      }
    } catch (err) {
      console.error('Error fetching visitors:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchVisitors();
  };

  const handleDeleteVisitor = async (id: number) => {
    if (!confirm('Are you sure you want to delete this presence record and snapshot?')) return;
    try {
      const res = await apiFetch(`/api/visitors/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchVisitors();
      }
    } catch (err) {
      console.error('Error deleting visitor:', err);
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (searchName.trim()) params.append('name', searchName.trim());
    if (statusFilter !== 'all') params.append('status', statusFilter);
    window.location.href = `/api/visitors/export?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header and Export Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <span>Presence Access History</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit log of all observed presence events from camera monitoring. Label: Observed presence events only (not door control).
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 shadow-sm transition-all shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>Export to CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Search by person name..."
            className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-blue-500 outline-none"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs outline-none focus:border-blue-500"
          >
            <option value="all">All Classifications</option>
            <option value="authorized">Authorized Only</option>
            <option value="unknown">Unknown Visitors Only</option>
            <option value="unrecognized">Unrecognized / Blurry</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading access records...</div>
        ) : visitors.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No presence events found matching the criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 bg-slate-950/60 border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-3 px-4">Subject / Name</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Snapshot</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {visitors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-200">{v.name}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          v.recognition_status === 'authorized'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : v.recognition_status === 'unknown'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {v.recognition_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {Math.round(v.confidence * 100)}%
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {v.timestamp ? new Date(v.timestamp).toLocaleString() : ''}
                    </td>
                    <td className="py-3 px-4">
                      {v.snapshot_path ? (
                        <button
                          onClick={() => setSelectedSnapshot(v.snapshot_path)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 text-[11px] font-semibold flex items-center gap-1.5"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No Snapshot</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteVisitor(v.id)}
                        title="Delete Record"
                        className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing page {page} of {pages} ({total} total records)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-md bg-slate-950 border border-slate-800 disabled:opacity-40 hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="p-1.5 rounded-md bg-slate-950 border border-slate-800 disabled:opacity-40 hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Snapshot Preview Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200">Observed Presence Snapshot</h4>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-950">
              <img
                src={selectedSnapshot}
                alt="Presence Snapshot"
                className="max-h-[500px] w-auto object-contain rounded-lg border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
