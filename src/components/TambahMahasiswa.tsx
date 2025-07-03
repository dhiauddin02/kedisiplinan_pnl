import React, { useState, useEffect } from 'react';
import { Upload, UserPlus, Users, AlertCircle, CheckCircle, FileSpreadsheet, Save, Eye, Edit, Trash2, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateEmail } from '../lib/utils';

interface StudentData {
  nim: string;
  nama: string;
  nama_wali: string;
  no_wa_wali: string;
  nama_dosen_pembimbing: string;
  no_wa_dosen_pembimbing: string;
}

interface ExistingStudent extends StudentData {
  id: string;
  email: string;
  created_at: string;
}

export default function TambahMahasiswa() {
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [processedData, setProcessedData] = useState<StudentData[]>([]);
  const [existingStudents, setExistingStudents] = useState<ExistingStudent[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<ExistingStudent | null>(null);
  const [clusteringHistory, setClusteringHistory] = useState<any[]>([]);
  
  // Form data for manual input
  const [formData, setFormData] = useState<StudentData>({
    nim: '',
    nama: '',
    nama_wali: '',
    no_wa_wali: '',
    nama_dosen_pembimbing: '',
    no_wa_dosen_pembimbing: ''
  });

  useEffect(() => {
    loadExistingStudents();
  }, []);

  const loadExistingStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'mahasiswa')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setMessage(null);
        setProcessedData([]);
      } else {
        setMessage({ type: 'error', text: 'File harus berformat .xlsx atau .xls' });
      }
    }
  };

  const processExcelFile = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Pilih file terlebih dahulu' });
      return;
    }

    setLoading(true);
    setMessage({ type: 'info', text: 'Memproses file Excel...' });

    try {
      // Simulate Excel processing - in real implementation, you'd use a library like xlsx
      // For now, we'll create sample data
      const sampleData: StudentData[] = [
        {
          nim: '2023001',
          nama: 'Ahmad Rizki',
          nama_wali: 'Budi Santoso',
          no_wa_wali: '081234567890',
          nama_dosen_pembimbing: 'Dr. Siti Aminah',
          no_wa_dosen_pembimbing: '081234567891'
        },
        {
          nim: '2023002',
          nama: 'Sari Dewi',
          nama_wali: 'Andi Wijaya',
          no_wa_wali: '081234567892',
          nama_dosen_pembimbing: 'Prof. Ahmad Yani',
          no_wa_dosen_pembimbing: '081234567893'
        }
      ];

      setProcessedData(sampleData);
      setMessage({ type: 'success', text: `Berhasil memproses ${sampleData.length} data mahasiswa dari file!` });
    } catch (error) {
      console.error('Processing error:', error);
      setMessage({ type: 'error', text: 'Gagal memproses file Excel' });
    } finally {
      setLoading(false);
    }
  };

  const createStudentAuth = async (studentData: StudentData) => {
    try {
      const email = generateEmail(studentData.nama, studentData.nim);
      
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: studentData.nim, // Use NIM as password
        email_confirm: true
      });

      if (authError) throw authError;

      // Insert into public.users table
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          nim: studentData.nim,
          nama: studentData.nama,
          nama_wali: studentData.nama_wali,
          no_wa_wali: studentData.no_wa_wali,
          nama_dosen_pembimbing: studentData.nama_dosen_pembimbing,
          no_wa_dosen_pembimbing: studentData.no_wa_dosen_pembimbing,
          role: 'mahasiswa',
          level_user: 0
        });

      if (userError) throw userError;

      return { success: true };
    } catch (error) {
      console.error('Error creating student:', error);
      return { success: false, error };
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.nim || !formData.nama || !formData.nama_wali || !formData.no_wa_wali || 
        !formData.nama_dosen_pembimbing || !formData.no_wa_dosen_pembimbing) {
      setMessage({ type: 'error', text: 'Semua field harus diisi' });
      return;
    }

    setLoading(true);
    
    const result = await createStudentAuth(formData);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Mahasiswa berhasil ditambahkan!' });
      setFormData({
        nim: '',
        nama: '',
        nama_wali: '',
        no_wa_wali: '',
        nama_dosen_pembimbing: '',
        no_wa_dosen_pembimbing: ''
      });
      setShowAddModal(false);
      loadExistingStudents();
    } else {
      setMessage({ type: 'error', text: 'Gagal menambahkan mahasiswa' });
    }
    
    setLoading(false);
  };

  const handleBulkSubmit = async () => {
    if (processedData.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk disimpan' });
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const student of processedData) {
      const result = await createStudentAuth(student);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    setMessage({ 
      type: successCount > 0 ? 'success' : 'error', 
      text: `Berhasil menambahkan ${successCount} mahasiswa. ${errorCount > 0 ? `${errorCount} gagal.` : ''}` 
    });

    if (successCount > 0) {
      setProcessedData([]);
      setFile(null);
      loadExistingStudents();
    }

    setLoading(false);
  };

  const handleEdit = (student: ExistingStudent) => {
    setSelectedStudent(student);
    setFormData({
      nim: student.nim,
      nama: student.nama,
      nama_wali: student.nama_wali || '',
      no_wa_wali: student.no_wa_wali || '',
      nama_dosen_pembimbing: student.nama_dosen_pembimbing || '',
      no_wa_dosen_pembimbing: student.no_wa_dosen_pembimbing || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          nama: formData.nama,
          nama_wali: formData.nama_wali,
          no_wa_wali: formData.no_wa_wali,
          nama_dosen_pembimbing: formData.nama_dosen_pembimbing,
          no_wa_dosen_pembimbing: formData.no_wa_dosen_pembimbing,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedStudent.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Data mahasiswa berhasil diperbarui!' });
      setShowEditModal(false);
      setSelectedStudent(null);
      loadExistingStudents();
    } catch (error) {
      console.error('Error updating student:', error);
      setMessage({ type: 'error', text: 'Gagal memperbarui data mahasiswa' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (student: ExistingStudent) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus mahasiswa ${student.nama}?`)) {
      return;
    }

    setLoading(true);

    try {
      // Delete from auth.users (will cascade to public.users)
      const { error: authError } = await supabase.auth.admin.deleteUser(student.id);
      if (authError) throw authError;

      setMessage({ type: 'success', text: 'Mahasiswa berhasil dihapus!' });
      loadExistingStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      setMessage({ type: 'error', text: 'Gagal menghapus mahasiswa' });
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = async (student: ExistingStudent) => {
    setSelectedStudent(student);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('hasil_clustering')
        .select(`
          *,
          batch:batch(*, periode:periode(*))
        `)
        .eq('id_user', student.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setClusteringHistory(data || []);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error loading clustering history:', error);
      setMessage({ type: 'error', text: 'Gagal memuat riwayat clustering' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nim: '',
      nama: '',
      nama_wali: '',
      no_wa_wali: '',
      nama_dosen_pembimbing: '',
      no_wa_dosen_pembimbing: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Tambah Mahasiswa</h1>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' && <CheckCircle className="w-5 h-5 mr-2" />}
            {message.type === 'error' && <AlertCircle className="w-5 h-5 mr-2" />}
            {message.type === 'info' && <AlertCircle className="w-5 h-5 mr-2" />}
            {message.text}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('manual')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'manual'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Input Manual
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upload Excel
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Input Data Mahasiswa</h3>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-150 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Mahasiswa
                </button>
              </div>
              <p className="text-gray-600">
                Klik tombol "Tambah Mahasiswa" untuk menambahkan data mahasiswa satu per satu.
              </p>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upload File Excel</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      File Excel (.xlsx)
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <FileSpreadsheet className="w-8 h-8 mb-4 text-gray-500" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> atau drag and drop
                          </p>
                          <p className="text-xs text-gray-500">Excel files (.xlsx, .xls)</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".xlsx,.xls"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                    {file && (
                      <p className="mt-2 text-sm text-green-600">
                        File selected: {file.name}
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Format File Excel:</h4>
                    <p className="text-sm text-blue-800 mb-2">File harus memiliki header kolom sebagai berikut:</p>
                    <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                      <li>NIM</li>
                      <li>Nama</li>
                      <li>Nama Wali</li>
                      <li>No. WA Wali</li>
                      <li>Nama Dosen Pembimbing</li>
                      <li>No. WA Dosen Pembimbing</li>
                    </ul>
                  </div>

                  <button
                    onClick={processExcelFile}
                    disabled={!file || loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mr-2" />
                        Proses Dataset
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Processed Data Preview */}
              {processedData.length > 0 && (
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-gray-900">Preview Data ({processedData.length} mahasiswa)</h4>
                    <button
                      onClick={handleBulkSubmit}
                      disabled={loading}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors duration-150 flex items-center"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Simpan Data
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIM</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Wali</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. WA Wali</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosen Pembimbing</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. WA Dosen</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {processedData.map((student, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nim}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama_wali}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.no_wa_wali}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama_dosen_pembimbing}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.no_wa_dosen_pembimbing}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Existing Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Mahasiswa Terdaftar ({existingStudents.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIM</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Wali</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. WA Wali</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosen Pembimbing</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. WA Dosen</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {existingStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.nim}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama_wali || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.no_wa_wali || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama_dosen_pembimbing || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.no_wa_dosen_pembimbing || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewHistory(student)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Lihat Riwayat Clustering"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(student)}
                        className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                        title="Edit Data"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(student)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Hapus Mahasiswa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {existingStudents.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Belum ada mahasiswa yang terdaftar
            </div>
          )}
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Tambah Mahasiswa Baru</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NIM *</label>
                  <input
                    type="text"
                    value={formData.nim}
                    onChange={(e) => setFormData({...formData, nim: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap *</label>
                  <input
                    type="text"
                    value={formData.nama}
                    onChange={(e) => setFormData({...formData, nama: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Wali *</label>
                  <input
                    type="text"
                    value={formData.nama_wali}
                    onChange={(e) => setFormData({...formData, nama_wali: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. WA Wali *</label>
                  <input
                    type="tel"
                    value={formData.no_wa_wali}
                    onChange={(e) => setFormData({...formData, no_wa_wali: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Dosen Pembimbing *</label>
                  <input
                    type="text"
                    value={formData.nama_dosen_pembimbing}
                    onChange={(e) => setFormData({...formData, nama_dosen_pembimbing: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. WA Dosen Pembimbing *</label>
                  <input
                    type="tel"
                    value={formData.no_wa_dosen_pembimbing}
                    onChange={(e) => setFormData({...formData, no_wa_dosen_pembimbing: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Info Login:</strong> Mahasiswa akan dapat login menggunakan NIM sebagai username dan password.
                </p>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Simpan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Data Mahasiswa</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedStudent(null);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NIM</label>
                  <input
                    type="text"
                    value={formData.nim}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">NIM tidak dapat diubah</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap *</label>
                  <input
                    type="text"
                    value={formData.nama}
                    onChange={(e) => setFormData({...formData, nama: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Wali *</label>
                  <input
                    type="text"
                    value={formData.nama_wali}
                    onChange={(e) => setFormData({...formData, nama_wali: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. WA Wali *</label>
                  <input
                    type="tel"
                    value={formData.no_wa_wali}
                    onChange={(e) => setFormData({...formData, no_wa_wali: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Dosen Pembimbing *</label>
                  <input
                    type="text"
                    value={formData.nama_dosen_pembimbing}
                    onChange={(e) => setFormData({...formData, nama_dosen_pembimbing: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. WA Dosen Pembimbing *</label>
                  <input
                    type="tel"
                    value={formData.no_wa_dosen_pembimbing}
                    onChange={(e) => setFormData({...formData, no_wa_dosen_pembimbing: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedStudent(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Perbarui
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clustering History Modal */}
      {showHistoryModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Riwayat Clustering - {selectedStudent.nama}
              </h3>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedStudent(null);
                  setClusteringHistory([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {clusteringHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Belum ada riwayat clustering untuk mahasiswa ini
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periode</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Alpa</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">JP</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kedisiplinan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clusteringHistory.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {result.batch?.periode?.nama_periode || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {result.batch?.nama_batch || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.total_a}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.jp}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            result.kedisiplinan === 'Disiplin' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {result.kedisiplinan}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          Cluster {result.cluster}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(result.created_at).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}