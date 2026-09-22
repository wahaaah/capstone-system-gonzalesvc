import { useState, useRef, useEffect, useCallback } from 'react';
import { frameService, type Frame } from '../services/frameService';
import { UploadCloud, ImagePlus, Box, X, Sparkles, Pencil, Trash2, Plus, RefreshCw, Search } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface FrameUploaderProps {
  onCreated: () => void;
}

const API_BASE = 'https://gonzalesvisionclinic.onrender.com/api';
const SERVER_HOST = 'https://gonzalesvisionclinic.onrender.com/api';
const MAX_FILE_SIZE_MB = 15; 

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

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', '2D Only', '3D Ready'

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

  // Try-on feature states
  const [isTryOnOpen, setIsTryOnOpen] = useState(false);
  const [activeTryOnUrl, setActiveTryOnUrl] = useState<string | null>(null);
  const [vtoStatus, setVtoStatus] = useState('Initializing face detection...');

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

  // Virtual Try-On Lifecycle Effect (Three.js + Face-API)
  useEffect(() => {
    if (!isTryOnOpen || !activeTryOnUrl) return;

    let currentStream: MediaStream | null = null;
    let animationFrameId: number;
    let detectionInterval: number;

    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    // Setup Three.js Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, modalContainer.clientWidth / modalContainer.clientHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(modalContainer.clientWidth, modalContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    modalContainer.appendChild(renderer.domElement);

    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(1, 1, 1).normalize();
    scene.add(dirLight);

    let loadedModel: THREE.Group | null = null;
    const loader = new GLTFLoader();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Load Face-API models and GLTF Frame
    const initTryOn = async () => {
      try {
        setVtoStatus('Loading face detection models...');
        await Promise.all([
          (window as any).faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
          (window as any).faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
        ]);

        setVtoStatus('Accessing webcam...');
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });

        const video = document.createElement('video');
        video.srcObject = currentStream;
        video.play();

        const videoTexture = new THREE.VideoTexture(video);
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(20, 20),
          new THREE.MeshBasicMaterial({ map: videoTexture, side: THREE.DoubleSide })
        );
        plane.position.set(0, 0, -5);
        scene.add(plane);

        loader.load(activeTryOnUrl, (gltf) => {
          loadedModel = gltf.scene;
          loadedModel.scale.set(0.1, 0.1, 0.1);
          loadedModel.rotation.y = Math.PI;
          loadedModel.position.set(-5, 0, -5);
          scene.add(loadedModel);
          setVtoStatus('Ready — looking for face landmarks');
        });

        video.addEventListener('playing', () => {
          const displaySize = { width: video.videoWidth, height: video.videoHeight };

          detectionInterval = setInterval(async () => {
            if (!loadedModel) return;
            const detections = await (window as any).faceapi.detectAllFaces(video).withFaceLandmarks();

            if (detections.length > 0) {
              const detection = detections[0];
              const leftEye = detection.landmarks.getLeftEye();
              const rightEye = detection.landmarks.getRightEye();

              const centerX = (leftEye[0].x + rightEye[0].x) / 2;
              const centerY = (leftEye[0].y + rightEye[0].y) / 2;

              // Screen to World Coordinates conversion mapping
              const x = (centerX / displaySize.width) * 2 - 1;
              const y = -(centerY / displaySize.height) * 2 + 1;
              const vector = new THREE.Vector3(x, y, 0.5);
              vector.unproject(camera);
              const dir = vector.sub(camera.position).normalize();
              const distance = -camera.position.z / dir.z;
              const worldCenter = camera.position.clone().add(dir.multiplyScalar(distance));

              loadedModel.position.set(worldCenter.x, worldCenter.y - 1, worldCenter.z);

              const deltaY = rightEye[0].y - leftEye[0].y;
              const deltaX = rightEye[0].x - leftEye[0].x;
              loadedModel.rotation.z = Math.atan2(deltaY, deltaX);

              const eyeDist = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
              const scaleFactor = eyeDist / 200;
              if (!isNaN(scaleFactor) && scaleFactor > 0) {
                loadedModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
              }
            }
          }, 100);
        });
      } catch (err) {
        console.error('VTO Error:', err);
        setVtoStatus('Camera access denied or model load failed.');
      }
    };

    initTryOn();

    // Cleanup on close
    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(detectionInterval);
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      if (renderer.domElement && modalContainer.contains(renderer.domElement)) {
        modalContainer.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isTryOnOpen, activeTryOnUrl]);

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
    
    const resp = await fetch(`${API_BASE}/upload`, { 
      method: 'POST', 
      body: formData 
    });
    
    if (!resp.ok) throw new Error('Upload failed');
    const data = await resp.json();

    // Directly assign data.url since your backend sends res.json({ url: fileUrl, ... })
    const rawUrl = data.url || '';
    const formatted = formatImageUrl(rawUrl);
    
    setUploadedImageUrl(formatted);
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
      formData.append('file', file); 
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

  // Filtered frames logic
  const filteredFrames = frames.filter((frame) => {
    const matchesSearch = 
      (frame.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (frame.brand?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const is3D = !!frame.model_3d_url;
    const matchesStatus = 
      statusFilter === 'ALL' || 
      (statusFilter === '3D Ready' && is3D) || 
      (statusFilter === '2D Only' && !is3D);

    return matchesSearch && matchesStatus;
  });

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
        
        {/* Header & Controls Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-700">
            Frame Catalog Items ({filteredFrames.length} {filteredFrames.length !== frames.length && `of ${frames.length}`})
          </h4>
          
          {/* Search Bar & Status Filter */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search by name or brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="2D Only">2D Only</option>
              <option value="3D Ready">3D Ready</option>
            </select>

            <button onClick={loadFrames} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 p-1.5 border border-slate-200 rounded-lg bg-slate-50/50 hover:bg-slate-100">
              <RefreshCw size={12} className={isLoadingCatalog ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {filteredFrames.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            {frames.length === 0 ? 'No frame items available in catalog.' : 'No frames match your search or filter criteria.'}
          </p>
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
                {filteredFrames.map((frame) => {
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
                        {is3D && (
                          <button
                            type="button"
                            onClick={() => {
                              const fullModelUrl = frame.model_3d_url!.startsWith('http')
                                ? frame.model_3d_url!
                                : `${SERVER_HOST}${frame.model_3d_url!.startsWith('/') ? '' : '/'}${frame.model_3d_url!}`;
                              setActiveTryOnUrl(fullModelUrl);
                              setIsTryOnOpen(true);
                            }}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-md"
                            title="Test Virtual Try-On"
                          >
                            <Box size={14} />
                          </button>
                        )}
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

      {/* Virtual Try-On Modal */}
      {isTryOnOpen && (
        <div 
          id="faceFilterModal" 
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setIsTryOnOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full p-5 relative shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-600" /> Live Virtual Try-On Test
                </h3>
                <p id="vto-status" className="text-xs text-slate-500 mt-0.5">{vtoStatus}</p>
              </div>
              <button 
                onClick={() => setIsTryOnOpen(false)} 
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Three.js Render Target Container */}
            <div 
              id="modal-container" 
              className="relative w-full h-[400px] bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 shadow-inner"
            />

            <div className="mt-4 flex justify-end w-full">
              <button
                type="button"
                onClick={() => setIsTryOnOpen(false)}
                className="bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Modal */}
      {showFullImageModal && imagePreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowFullImageModal(false)}>
          <div className="relative bg-white rounded-2xl max-w-md w-full p-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-semibold text-slate-700">Image Preview</h3>
              <button onClick={() => setShowFullImageModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <img src={imagePreview} alt="Full Preview" className="w-full h-auto rounded-lg object-contain max-h-[70vh]" />
          </div>
        </div>
      )}
    </div>
    
  );
}


