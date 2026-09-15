import { useState, useEffect } from 'react';
import { frameService, type Frame } from '../services/frameService';
import FrameUploader from '../component/FrameUploader';
import { Glasses, RotateCw, Search, Sparkles } from 'lucide-react';

// NOTE on scope: this page implements the catalog + conversion-workflow management UI
// described in the paper (Frame Models / Virtual Eyewear Try-On pages). It does NOT
// implement the actual OpenCV facial-feature-detection + 3D-reconstruction pipeline —
// that's a substantial CV/ML project on its own. `frameService.convert()` models the
// workflow contract (Not Converted -> Processing -> Converted, storing a model_3d_url)
// so a real pipeline can be dropped in behind the same endpoint later.
export default function FrameConversionPage() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Search & Filter States for Conversion Table
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'Not Converted', 'Processing', 'Converted', 'Failed'

  useEffect(() => {
    loadFrames();
  }, []);

  const loadFrames = async () => {
    setIsLoading(true);
    try {
      const data = await frameService.getAll();
      setFrames(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load frames.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvert = async (frame: Frame) => {
    setConvertingId(frame.frame_id);
    try {
      // Placeholder model path until a real 2D-to-3D pipeline is wired in.
      await frameService.convert(frame.frame_id, `/models/frame-${frame.frame_id}.glb`);
      await loadFrames();
    } catch (err: any) {
      setError(err.message || 'Conversion failed.');
    } finally {
      setConvertingId(null);
    }
  };

  const statusColor: Record<string, string> = {
    'Not Converted': 'bg-slate-100 text-slate-500',
    Processing: 'bg-amber-100 text-amber-600',
    Converted: 'bg-emerald-100 text-emerald-600',
    Failed: 'bg-red-100 text-red-600',
  };

  // Filtered frames logic for the conversion table
  const filteredFrames = frames.filter((frame) => {
    const matchesSearch = 
      (frame.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (frame.brand?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (frame.material?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'ALL' || 
      frame.conversion_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Frame Inventory</h2>
        <p className="text-sm text-slate-500 mt-1">
          Manage the eyeglass frame catalog and 2D-to-3D conversion status for the virtual try-on feature.
        </p>
      </div>

      <FrameUploader onCreated={loadFrames} />

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Frame 3D Conversion Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
        
        {/* Title, Search, and Status Filters Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Sparkles size={16} className="text-blue-600" /> Frame 3D Conversion Workflow
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Showing {filteredFrames.length} {filteredFrames.length !== frames.length && `of ${frames.length}`} items
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search Bar */}
            <div className="relative flex-1 sm:w-60">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search frame, brand, material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Dropdown Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="Not Converted">Not Converted</option>
              <option value="Processing">Processing</option>
              <option value="Converted">Converted</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-6 text-center">Loading frames...</p>
        ) : filteredFrames.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            {frames.length === 0 ? 'No frames in the catalog yet — add one above.' : 'No frames match your search or status filter.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="p-3 font-medium">Image</th>
                  <th className="p-3 font-medium">Frame</th>
                  <th className="p-3 font-medium">Brand / Material</th>
                  <th className="p-3 font-medium">Price</th>
                  <th className="p-3 font-medium">Stock</th>
                  <th className="p-3 font-medium">Conversion status</th>
                  <th className="p-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredFrames.map((frame) => (
                  <tr key={frame.frame_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3">
                      <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center overflow-hidden border border-slate-100">
                        {frame.image_2d_url ? (
                          <img src={frame.image_2d_url} alt={frame.name} className="w-full h-full object-cover" />
                        ) : (
                          <Glasses size={16} className="text-blue-200" />
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-slate-700">{frame.name}</p>
                      {frame.description && (
                        <p className="text-xs text-slate-400 line-clamp-1">{frame.description}</p>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 text-xs">
                      {frame.brand || '—'} / {frame.material || '—'}
                    </td>
                    <td className="p-3 text-slate-700 font-medium">₱{Number(frame.price).toFixed(2)}</td>
                    <td className="p-3 text-slate-500">{frame.stock_quantity}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${statusColor[frame.conversion_status] || 'bg-slate-100 text-slate-500'}`}>
                        {frame.conversion_status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {frame.conversion_status !== 'Converted' && (
                        <button
                          onClick={() => handleConvert(frame)}
                          disabled={convertingId === frame.frame_id}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <RotateCw size={12} className={convertingId === frame.frame_id ? 'animate-spin' : ''} />
                          {convertingId === frame.frame_id ? 'Converting...' : 'Convert to 3D'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}