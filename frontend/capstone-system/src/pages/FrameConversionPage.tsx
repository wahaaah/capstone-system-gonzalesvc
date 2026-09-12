import { useState, useEffect } from 'react';
import { frameService, type Frame } from '../services/frameService';
import FrameUploader from '../component/FrameUploader';
import { Glasses, RotateCw } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Frame conversion</h2>
        <p className="text-sm text-slate-500 mt-1">
          Manage the eyeglass frame catalog and 2D-to-3D conversion status for the virtual try-on feature.
        </p>
      </div>

      <FrameUploader onCreated={loadFrames} />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200">
        {isLoading ? (
          <p className="text-sm text-slate-400 p-5">Loading frames...</p>
        ) : frames.length === 0 ? (
          <p className="text-sm text-slate-400 p-5">No frames in the catalog yet — add one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="p-4 font-medium">Image</th>
                <th className="p-4 font-medium">Frame</th>
                <th className="p-4 font-medium">Brand / Material</th>
                <th className="p-4 font-medium">Price</th>
                <th className="p-4 font-medium">Stock</th>
                <th className="p-4 font-medium">Conversion status</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {frames.map((frame) => (
                <tr key={frame.frame_id} className="border-b border-slate-50 last:border-0">
                  <td className="p-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center overflow-hidden">
                      {frame.image_2d_url ? (
                        <img src={frame.image_2d_url} alt={frame.name} className="w-full h-full object-cover" />
                      ) : (
                        <Glasses size={16} className="text-blue-200" />
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-slate-700">{frame.name}</p>
                    {frame.description && (
                      <p className="text-xs text-slate-400 line-clamp-1">{frame.description}</p>
                    )}
                  </td>
                  <td className="p-4 text-slate-500">{frame.brand} / {frame.material}</td>
                  <td className="p-4 text-slate-700">₱{Number(frame.price).toFixed(2)}</td>
                  <td className="p-4 text-slate-500">{frame.stock_quantity}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${statusColor[frame.conversion_status]}`}>
                      {frame.conversion_status}
                    </span>
                  </td>
                  <td className="p-4">
                    {frame.conversion_status !== 'Converted' && (
                      <button
                        onClick={() => handleConvert(frame)}
                        disabled={convertingId === frame.frame_id}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
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
        )}
      </div>
    </div>
  );
}
