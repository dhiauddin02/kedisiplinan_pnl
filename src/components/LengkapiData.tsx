import React, { useState, useEffect } from 'react';
import { Save, User, Phone, UserCheck, GraduationCap, Users } from 'lucide-react';
import { getCurrentUser, saveUserProfile } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

export default function LengkapiData() {
  const [formData, setFormData] = useState({
    nama: '',
    nim: '',
    tingkat: '',
    kelas: '',
    nama_wali: '',
    no_wa_wali: '',
    nama_dosen_pembimbing: '',
    no_wa_dosen_pembimbing: ''
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isUpdate, setIsUpdate] = useState(false);
  const navigate = useNavigate();
  const user = getCurrentUser();

  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        // Check if user already has profile data
        if (user.nama && user.nim) {
          setFormData({
            nama: user.nama || '',
            nim: user.nim || '',
            tingkat: user.tingkat || '',
            kelas: user.kelas || '',
            nama_wali: user.nama_wali || '',
            no_wa_wali: user.no_wa_wali || '',
            nama_dosen_pembimbing: user.nama_dosen_pembimbing || '',
            no_wa_dosen_pembimbing: user.no_wa_dosen_pembimbing || ''
          });
          setIsUpdate(true);
        }
      }
      setInitialLoading(false);
    };

    loadUserProfile();
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.nama.trim()) {
      setMessage({ type: 'error', text: 'Nama harus diisi' });
      return false;
    }
    if (!formData.nim.trim()) {
      setMessage({ type: 'error', text: 'NIM harus diisi' });
      return false;
    }
    if (!formData.tingkat.trim()) {
      setMessage({ type: 'error', text: 'Tingkat harus diisi' });
      return false;
    }
    if (!formData.kelas.trim()) {
      setMessage({ type: 'error', text: 'Kelas harus diisi' });
      return false;
    }
    if (!formData.nama_wali.trim()) {
      setMessage({ type: 'error', text: 'Nama wali harus diisi' });
      return false;
    }
    if (!formData.no_wa_wali.trim()) {
      setMessage({ type: 'error', text: 'Nomor WA wali harus diisi' });
      return false;
    }
    if (!formData.nama_dosen_pembimbing.trim()) {
      setMessage({ type: 'error', text: 'Nama dosen pembimbing harus diisi' });
      return false;
    }
    if (!formData.no_wa_dosen_pembimbing.trim()) {
      setMessage({ type: 'error', text: 'Nomor WA dosen pembimbing harus diisi' });
      return false;
    }

    // Validate phone numbers (basic validation)
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (!phoneRegex.test(formData.no_wa_wali)) {
      setMessage({ type: 'error', text: 'Format nomor WA wali tidak valid' });
      return false;
    }
    if (!phoneRegex.test(formData.no_wa_dosen_pembimbing)) {
      setMessage({ type: 'error', text: 'Format nomor WA dosen pembimbing tidak valid' });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !user) return;

    setLoading(true);
    setMessage(null);

    try {
      await saveUserProfile(formData);

      setMessage({ type: 'success', text: `Profil berhasil ${isUpdate ? 'diperbarui' : 'disimpan'}!` });
      
      // Redirect to main page after successful save
      setTimeout(() => {
        navigate('/clustering-pribadi');
      }, 2000);
    } catch (error) {
      console.error('Error saving user profile:', error);
      if (error instanceof Error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'error', text: 'Gagal menyimpan profil' });
      }
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <div>Loading...</div>;
  }

  const tingkatOptions = ['TK1', 'TK2', 'TK3', 'TK4'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {isUpdate ? 'Perbarui Data Diri' : 'Lengkapi Data Diri'}
        </h1>
        <p className="mt-2 text-gray-600">
          {isUpdate 
            ? 'Perbarui informasi profil Anda' 
            : 'Silakan lengkapi data Anda untuk dapat menggunakan sistem dengan optimal'
          }
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* User Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Akun</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="text"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <input
              type="text"
              value="Mahasiswa"
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Data Pribadi</h2>
        
        {/* Personal Data */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-700 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-600" />
            Informasi Mahasiswa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Lengkap *
              </label>
              <input
                type="text"
                name="nama"
                value={formData.nama}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150"
                placeholder="Masukkan nama lengkap"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NIM *
              </label>
              <input
                type="text"
                name="nim"
                value={formData.nim}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150"
                placeholder="Masukkan NIM"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tingkat *
              </label>
              <select
                name="tingkat"
                value={formData.tingkat}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150"
                required
              >
                <option value="">Pilih Tingkat</option>
                {tingkatOptions.map(tingkat => (
                  <option key={tingkat} value={tingkat}>{tingkat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kelas *
              </label>
              <input
                type="text"
                name="kelas"
                value={formData.kelas}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150"
                placeholder="Masukkan kelas (contoh: A, B, C)"
                required
              />
            </div>
          </div>
        </div>

        {/* Wali Data */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-700 flex items-center">
            <Users className="w-5 h-5 mr-2 text-green-600" />
            Data Wali
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Wali *
              </label>
              <input
                type="text"
                name="nama_wali"
                value={formData.nama_wali}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150"
                placeholder="Masukkan nama wali"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nomor WhatsApp Wali *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  name="no_wa_wali"
                  value={formData.no_wa_wali}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150"
                  placeholder="contoh: 081234567890"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dosen Pembimbing Data */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-700 flex items-center">
            <GraduationCap className="w-5 h-5 mr-2 text-purple-600" />
            Data Dosen Pembimbing
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Dosen Pembimbing *
              </label>
              <input
                type="text"
                name="nama_dosen_pembimbing"
                value={formData.nama_dosen_pembimbing}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150"
                placeholder="Masukkan nama dosen pembimbing"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nomor WhatsApp Dosen Pembimbing *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  name="no_wa_dosen_pembimbing"
                  value={formData.no_wa_dosen_pembimbing}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150"
                  placeholder="contoh: 081234567890"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {isUpdate ? 'Perbarui Data' : 'Simpan Data'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <UserCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Informasi Penting</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Semua data yang bertanda (*) wajib diisi</li>
                <li>Data yang Anda masukkan akan digunakan untuk mengirim notifikasi hasil clustering</li>
                <li>Pastikan nomor WhatsApp yang dimasukkan aktif dan dapat menerima pesan</li>
                <li>Format nomor WhatsApp: gunakan kode negara atau awali dengan 08</li>
                <li>Data ini dapat diubah kapan saja melalui halaman ini</li>
                <li>NIM harus unik dan tidak boleh sama dengan mahasiswa lain</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}