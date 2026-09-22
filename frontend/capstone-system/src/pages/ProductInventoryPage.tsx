import { useState, useEffect, useRef, useCallback } from 'react';
import { posService, type Product } from '../services/posService';
import { Package, ImageOff, Pencil, Trash2, ImagePlus, X, RefreshCw } from 'lucide-react';

const SERVER_HOST = 'https://gonzalesvisionclinic.onrender.com';
const API_BASE = `${SERVER_HOST}/api`;

// Helper function to build correct backend image URLs
const formatImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  return `${SERVER_HOST}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function ProductInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await posService.getProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const clearImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageUrl('');
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCategory('');
    setDescription('');
    setPrice('');
    setStock('');
    setError('');
    clearImage();
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setCategory(product.category || '');
    setDescription(product.description || '');
    setImageUrl(product.image_url || '');
    setImagePreview(product.image_url ? formatImageUrl(product.image_url) : null);
    setPrice(String(product.price));
    setStock(String(product.stock_quantity));
    setError('');
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  console.log('📸 Product image selected:', file.name);
  console.log('📦 File size:', file.size);
  console.log('📦 File type:', file.type);

  if (imagePreview && imagePreview.startsWith('blob:')) {
    URL.revokeObjectURL(imagePreview);
  }

  setImagePreview(URL.createObjectURL(file));
  setIsUploading(true);
  setError('');

  try {
    const formData = new FormData();
    formData.append('file', file);

    console.log('📤 Uploading product image to:', `${API_BASE}/upload`);

    const resp = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });

    console.log('📥 Upload response status:', resp.status);

    const data = await resp.json();

    console.log('📥 Upload response:', data);

    if (!resp.ok) {
      throw new Error(data.error || `Upload failed with status ${resp.status}`);
    }

    const rawUrl = data.url || data.secure_url || data.imageUrl || '';

    console.log('🔗 Cloudinary URL:', rawUrl);

    if (!rawUrl) {
      throw new Error('Upload succeeded but no image URL was returned.');
    }

    setImageUrl(rawUrl);

  } catch (err: any) {
    console.error('❌ Product image upload error:', err);

    setError(
      'Image upload failed — ' +
      (err.message || 'please try again.')
    );

    clearImage();
  } finally {
    setIsUploading(false);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !price) {
      setError('Name and price are required.');
      return;
    }
    if (isUploading) {
      setError('Image is still uploading. Please wait.');
      return;
    }

    setIsSaving(true);
    const payload = {
      name,
      category: category || null,
      description: description || null,
      image_url: imageUrl || null,
      price: Number(price),
      stock_quantity: Number(stock) || 0,
    };

    try {
      if (editingId) {
        await posService.updateProduct(editingId, payload);
      } else {
        await posService.createProduct(payload);
      }
      resetForm();
      await loadProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to save product.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await posService.removeProduct(id);
      if (editingId === id) resetForm();
      await loadProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to delete product.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Medical Products Inventory</h2>
          <p className="text-sm text-slate-500 mt-1">
            Track quantities, descriptions, and product photos for contact lenses, solutions, and clinical supplies.
          </p>
        </div>
        <button 
          onClick={loadProducts} 
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white border border-slate-200 px-3 py-2 rounded-lg"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
          <Package size={16} className="text-blue-600" /> 
          {editingId ? `Editing Product (#${editingId})` : 'Add New Product'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input 
            placeholder="Product name *" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
          />
          <input 
            placeholder="Category (e.g. Solutions, Lenses)" 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
          />
          <input 
            placeholder="Price *" 
            type="number" 
            value={price} 
            onChange={(e) => setPrice(e.target.value)} 
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
          />
          <input 
            placeholder="Stock quantity" 
            type="number" 
            value={stock} 
            onChange={(e) => setStock(e.target.value)} 
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm" 
          />
        </div>

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />

        {/* File Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Product Photo</label>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageSelect} className="hidden" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 text-sm border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
            >
              <ImagePlus size={16} />
              {isUploading ? 'Uploading…' : imagePreview ? 'Change Image' : 'Add Image'}
            </button>
            {imagePreview && (
              <div className="flex items-center gap-2">
                <img src={imagePreview} alt="preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                <button type="button" onClick={clearImage} className="p-1 text-slate-400 hover:text-red-500 rounded-lg" title="Remove image">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={isSaving || isUploading}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="bg-slate-100 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-200">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Catalog Grid */}
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading inventory...</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-slate-400">No products available in inventory.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const formattedImage = formatImageUrl(product.image_url);

            return (
              <div key={product.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between">
                <div>
                  <div className="h-36 bg-slate-100 flex items-center justify-center relative overflow-hidden border-b border-slate-100">
                    {formattedImage ? (
                      <img 
                        src={formattedImage} 
                        alt={product.name} 
                        className="h-full w-full object-cover" 
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} 
                      />
                    ) : (
                      <ImageOff size={24} className="text-slate-300" />
                    )}
                    {product.category && (
                      <span className="absolute top-2 right-2 bg-slate-900/70 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {product.category}
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-800 text-sm line-clamp-1">{product.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${product.stock_quantity <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        Qty: {product.stock_quantity}
                      </span>
                    </div>

                    {product.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{product.description}</p>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">₱{Number(product.price).toFixed(2)}</p>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(product)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(product.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}