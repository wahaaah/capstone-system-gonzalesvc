import { useState, useRef, useEffect, useCallback } from 'react';
import { frameService, type Frame } from '../services/frameService';
import { UploadCloud, ImagePlus, Box, X, Sparkles, Pencil, Trash2, Plus, RefreshCw } from 'lucide-react';

interface FrameUploaderProps {
  onCreated: () => void;
}

const API_BASE = 'http://127.0.0.1:5000/api';
const SERVER_HOST = 'http://127.0.0.1:5000';
const MAX_FILE_SIZE_MB = 15; // Increased slightly to accommodate 3D models

// Helper to construct complete URLs for relative backend paths
const formatImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  return `${SERVER_HOST}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function FrameUploader({ onCreated }: FrameUploaderProps) {
  // Catalog List state
  const [frames, setFrames] = useState<Frame[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [material, setMaterial] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');

  // 2D Image States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 3D Model (GLB) States
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [uploadedGlbUrl, setUploadedGlbUrl] = useState<string>('');
  const [isUploadingGlb, setIsUploadingGlb] = useState(false);
  const glbInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);

  // Load catalog items
  const loadFrames = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const data = await frameService.getAll();
      setFrames(data);
    } catch (err: any) {
      console.error('Failed to load frames:', err);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadFrames();
  }, [loadFrames]);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const clearImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    setUploadedImageUrl('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const clearGlb = () => {
    setGlbFile(null);
    setUploadedGlbUrl('');
    if (glbInputRef.current) glbInputRef.current.value = '';
  };

  const reset = () => {
    setEditingId(null);
    setName(''); setBrand(''); setMaterial(''); setCategory(''); setDescription('');
    setPrice(''); setStock('');
    setError('');
    clearImage();
    clearGlb();
  };

  // Populate form with clicked item details
  const handleSelectFrame = (frame: Frame) => {
    setEditingId(frame.frame_id);
    setName(frame.name || '');
    setBrand(frame.brand || '');
    setMaterial(frame.material || '');
    setCategory(frame.category || '');
    setDescription(frame.description || '');
    setPrice(frame.price !== undefined ? String(frame.price) : '');
    setStock(frame.stock_quantity !== undefined ? String(frame.stock_quantity) : '');
    
    // Set 2D Image
    const rawImgUrl = frame.image_2d_url || frame.image_url || '';
    setUploadedImageUrl(rawImgUrl);
    setImagePreview(formatImageUrl(rawImgUrl) || null);
    setImageFile(null);

    // Set 3D Model
    setUploadedGlbUrl(frame.model_3d_url || '');
    setGlbFile(null);
    
    setError('');
  };

  // Delete frame from backend
  const handleDeleteFrame = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this frame item?')) return;

    try {
      await frameService.remove(id);
      if (editingId === id) reset();
      await loadFrames();
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to delete frame.');
    }
  };

  // Handle 2D Image Upload
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size must be less than ${MAX_FILE_SIZE_MB}MB.`);
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }

    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError('');
    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      if (!resp.ok) throw new Error('Upload failed');
      const data = await resp.json();

      const rawUrl = data.url || data.imageUrl || '';
      setUploadedImageUrl(formatImageUrl(rawUrl));
    } catch (err: any) {
      setError('Image upload failed — ' + (err.message || 'please try again.'));
      clearImage();
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Handle 3D GLB Upload
  const handleGlbSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.glb')) {
      setError('Only .glb files are supported for 3D models.');
      if (glbInputRef.current) glbInputRef.current.value = '';
      return;
    }

    setGlbFile(file);
    setError('');
    setIsUploadingGlb(true);

    try {
      const formData = new FormData();
      formData.append('file', file); // Assuming Flask accepts 'file' for both images and models
      const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      if (!resp.ok) throw new Error('GLB Upload failed');
      const data = await resp.json();

      const rawUrl = data.url || data.fileUrl || data.imageUrl || '';
      setUploadedGlbUrl(formatImageUrl(rawUrl));
    } catch (err: any) {
      setError('GLB upload failed — ' + (err.message || 'please try again.'));
      clearGlb();
    } finally {
      setIsUploadingGlb(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !price) { setError('Name and price are required.'); return; }
    if (imageFile && !uploadedImageUrl) { setError('Image is still uploading. Please wait.'); return; }
    if (glbFile && !uploadedGlbUrl) { setError('3D model is still uploading. Please wait.'); return; }

    setIsSaving(true);
    
    // Dynamic Conversion Status: Converted if GLB exists, otherwise Pending
    const currentConversionStatus: Frame['conversion_status'] = uploadedGlbUrl 
    ? 'Converted' 
    : 'Not Converted';

    const payload = {
      name,
      brand: brand || null,
      material: material || null,
      category: category || null,
      description: description || null,
      price: Number(price),
      stock_quantity: Number(stock) || 0,
      image_url: uploadedImageUrl || null,
      image_2d_url: uploadedImageUrl || null,
      model_3d_url: uploadedGlbUrl || null,
      conversion_status: currentConversionStatus,
    };
    
    try {
      if (editingId) {
        await frameService.update(editingId, payload);
      } else {
        await frameService.create(payload);
      }
      reset();
      await loadFrames();
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to save frame.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form Section (Create/Edit) */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              {editingId ? <Pencil size={16} className="text-blue-600" /> : <UploadCloud size={16} />}
              {editingId ? `Editing Frame (ID: #${editingId})` : 'Add new frame to catalog'}
            </h3>
            {editingId && (
              <button type="button" onClick={reset} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                <Plus size={14} /> Switch to Add Mode
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Frame name *" value={name} onChange={(e) => setName(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Material" value={material} onChange={(e) => setMaterial(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Price *" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Stock quantity" type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />

          {/* Uploads Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            
            {/* 2D Image Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">2D Frame Image</label>
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageSelect} className="hidden" />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isUploadingImage} className="flex items-center gap-2 text-sm border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                  <ImagePlus size={16} />
                  {isUploadingImage ? 'Uploading…' : imageFile ? 'Change image' : 'Add image'}
                </button>
                {imagePreview && (
                  <button type="button" onClick={clearImage} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Remove image">
                    <X size={16} />
                  </button>
                )}
              </div>
              {imagePreview && (
                <div className="mt-2 flex items-center gap-3">
                  <img src={imagePreview} alt="preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer" onClick={() => setShowFullImageModal(true)} />
                  <span className="text-[10px] text-emerald-600 font-medium">{isUploadingImage ? '...' : 'Uploaded ✓'}</span>
                </div>
              )}
            </div>

            {/* 3D Model Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">3D Model (.glb) - Optional</label>
              <input ref={glbInputRef} type="file" accept=".glb" onChange={handleGlbSelect} className="hidden" />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => glbInputRef.current?.click()} disabled={isUploadingGlb} className="flex items-center gap-2 text-sm border border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                  <Box size={16} />
                  {isUploadingGlb ? 'Uploading…' : glbFile ? 'Change .glb' : 'Add .glb file'}
                </button>
                {uploadedGlbUrl && (
                  <button type="button" onClick={clearGlb} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Remove 3D Model">
                    <X size={16} />
                  </button>
                )}
              </div>
              {uploadedGlbUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded">3D Ready</span>
                </div>
              )}
            </div>

          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-2 pt-2">
            <button type="submit" disabled={isSaving || isUploadingImage || isUploadingGlb} className={`text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${uploadedGlbUrl ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isSaving ? 'Saving…' : editingId ? 'Update frame' : uploadedGlbUrl ? 'Save & Publish to Landing Page' : 'Save & Send to 3D Conversion'}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="bg-slate-100 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-200">
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Live Catalog Preview */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" /> Live Catalog Preview
          </span>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex-1 flex flex-col justify-between relative">
            
            {/* 3D Badge on Preview */}
            {uploadedGlbUrl && (
              <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded z-10 shadow-sm flex items-center gap-1">
                <Box size={12}/> Try-On Ready
              </div>
            )}

            <div className="h-36 bg-slate-100 relative flex items-center justify-center overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="Live Card Preview" className="w-full h-full object-cover" onError={(e) => {(e.currentTarget as HTMLImageElement).style.display = 'none';}} />
              ) : (
                <span className="text-xs text-slate-400">No Image Selected</span>
              )}
              {category && (
                <span className="absolute top-2 right-2 bg-slate-900/70 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {category}
                </span>
              )}
            </div>

            <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">{brand || 'Brand'}</div>
                <div className="font-semibold text-slate-800 text-sm">{name || 'Frame Name'}</div>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1">{description || 'Frame description will appear here...'}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  {price ? `₱${Number(price).toLocaleString()}` : '₱0.00'}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${Number(stock) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {stock ? `${stock} in stock` : '0 in stock'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Frame Selectable List Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Frame Catalog Items ({frames.length})</h4>
          <button onClick={loadFrames} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
            <RefreshCw size={12} className={isLoadingCatalog ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {frames.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No frame items available in catalog.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium">
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Brand</th>
                  <th className="py-2 px-3">Price</th>
                  <th className="py-2 px-3">Stock</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {frames.map((frame) => {
                  const isSelected = editingId === frame.frame_id;
                  const rawImg = frame.image_2d_url || frame.image_url;
                  const imgUrl = formatImageUrl(rawImg);
                  const is3D = !!frame.model_3d_url;

                  return (
                    <tr
                      key={frame.frame_id}
                      onClick={() => handleSelectFrame(frame)}
                      className={`cursor-pointer transition-colors hover:bg-blue-50/50 ${isSelected ? 'bg-blue-50 font-medium' : ''}`}
                    >
                      <td className="py-2 px-3 flex items-center gap-2">
                        {imgUrl ? (
                          <img src={imgUrl} alt={frame.name} className="w-8 h-8 rounded object-cover border border-slate-200" onError={(e) => {(e.currentTarget as HTMLImageElement).style.display = 'none';}} />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">N/A</div>
                        )}
                        <span className="text-slate-800">{frame.name}</span>
                      </td>
                      <td className="py-2 px-3">
                        {is3D ? (
                          <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">3D Ready</span>
                        ) : (
                          <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">2D Only</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{frame.brand || '—'}</td>
                      <td className="py-2 px-3 font-semibold text-slate-700">₱{Number(frame.price).toLocaleString()}</td>
                      <td className="py-2 px-3 text-slate-500">{frame.stock_quantity}</td>
                      <td className="py-2 px-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => handleSelectFrame(frame)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md" title="Edit frame"><Pencil size={14} /></button>
                        <button type="button" onClick={(e) => handleDeleteFrame(frame.frame_id, e)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md" title="Delete frame"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Image Modal */}
      {showFullImageModal && imagePreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowFullImageModal(false)}>
          <div className="relative bg-white rounded-2xl max-w-md w-full p-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600">Image High-Res Preview</span>
              <button onClick={() => setShowFullImageModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <img src={imagePreview} alt="Full High Res Preview" className="w-full max-h-[60vh] object-contain rounded-lg border border-slate-100" />
          </div>
        </div>
      )}
    </div>
  );
}