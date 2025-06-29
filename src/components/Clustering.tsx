import React, { useState, useEffect } from 'react';
import { Upload, Play, Save, Users, AlertCircle, CheckCircle, FileSpreadsheet, Settings, Plus } from 'lucide-react';
import { clusteringAPI, databaseAPI } from '../lib/api';
import { supabase } from '../lib/supabase';

export default function Clustering() {
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState('REKAP-TK1');
  
  const [loading, setLoading] = useState(false);
  const [clusteringResults, setClusteringResults] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showAddPeriodModal, setShowAddPeriodModal] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  
  const [periods, setPeriods] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  
  const [newPeriod, setNewPeriod] = useState({ nama_periode: '', tahun_ajaran: '', semester: '' });
  const [newBatch, setNewBatch] = useState('');

  const sheetOptions = [
    'REKAP-TK1', 'REKAP-TK2', 'REKAP-TK3', 'REKAP-TK4'
  ];

  useEffect(() => {
    loadPeriodsAndBatches();
  }, []);

  const loadPeriodsAndBatches = async () => {
    try {
      const { data: periodsData } = await supabase.from('periode').select('*').order('created_at', { ascending: false });
      const { data: batchesData } = await supabase.from('batch').select('*, periode:periode(*)').order('created_at', { ascending: false });
      
      setPeriods(periodsData || []);
      setBatches(batchesData || []);
    } catch (error) {
      console.error('Error loading periods and batches:', error);
    }
  };

  const addPeriod = async () => {
    if (!newPeriod.nama_periode || !newPeriod.tahun_ajaran) {
      setMessage({ type: 'error', text: 'Lengkapi semua field yang wajib' });
      return;
    }

    try {
      const { error } = await supabase
        .from('periode')
        .insert(newPeriod);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Periode berhasil ditambahkan' });
      setShowAddPeriodModal(false);
      setNewPeriod({ nama_periode: '', tahun_ajaran: '', semester: '' });
      loadPeriodsAndBatches();
    } catch (error) {
      console.error('Error adding period:', error);
      setMessage({ type: 'error', text: 'Gagal menambahkan periode' });
    }
  };

  const addBatch = async () => {
    if (!newBatch || !selectedPeriod) {
      setMessage({ type: 'error', text: 'Pilih periode dan isi nama batch' });
      return;
    }

    try {
      const { error } = await supabase
        .from('batch')
        .insert({
          nama_batch: newBatch,
          id_periode: selectedPeriod,
          tgl_batch: new Date().toISOString().split('T')[0]
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Batch berhasil ditambahkan' });
      setShowAddBatchModal(false);
      setNewBatch('');
      loadPeriodsAndBatches();
    } catch (error) {
      console.error('Error adding batch:', error);
      setMessage({ type: 'error', text: 'Gagal menambahkan batch' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: 'File harus berformat .xlsx atau .xls' });
      }
    }
  };

  const validateDataset = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Pilih file terlebih dahulu' });
      return false;
    }
    if (!selectedPeriod) {
      setMessage({ type: 'error', text: 'Pilih periode terlebih dahulu' });
      return false;
    }
    if (!selectedBatch) {
      setMessage({ type: 'error', text: 'Pilih batch terlebih dahulu' });
      return false;
    }
    return true;
  };

  const processClustering = async () => {
    if (!await validateDataset()) return;

    setLoading(true);
    setMessage({ type: 'info', text: 'Memproses clustering...' });

    try {
      // Send to clustering API
      const results = await clusteringAPI.processFile(file!, sheetName);
      
      // Register students if not exists (with better error handling)
      await registerStudents(results);
      
      setClusteringResults(results);
      setMessage({ type: 'success', text: 'Clustering berhasil diproses!' });
    } catch (error) {
      console.error('Clustering error:', error);
      
      let errorMessage = 'Gagal memproses clustering';
      if (error instanceof Error) {
        if (error.message.includes('Clustering API URL not configured')) {
          errorMessage = 'Konfigurasi API clustering belum diatur. Hubungi administrator.';
        } else if (error.message.includes('Cannot connect to clustering service')) {
          errorMessage = 'Tidak dapat terhubung ke layanan clustering. Pastikan server clustering sedang berjalan.';
        } else if (error.message.includes('Clustering API error')) {
          errorMessage = `Error dari server clustering: ${error.message}`;
        } else {
          errorMessage = error.message;
        }
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const registerStudents = async (results: any[]) => {
    let registeredCount = 0;
    let existingCount = 0;
    
    for (const result of results) {
      try {
        const nim = result.NIM?.toString();
        if (!nim) continue;

        // Check if student exists first
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id, nim')
          .eq('nim', nim)
          .maybeSingle(); // Use maybeSingle to avoid error when no record found

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing user:', checkError);
          continue;
        }

        if (existingUser) {
          existingCount++;
          console.log(`Student ${nim} already exists, skipping registration`);
          continue;
        }

        // Generate email for new student
        const email = `${nim}@student.pnl.ac.id`;
        
        // Create user in Supabase Auth first
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: email,
          password: nim, // Use NIM as default password
          email_confirm: true
        });

        if (authError) {
          console.error('Error creating auth user:', authError);
          continue;
        }

        if (!authData.user) {
          console.error('No user returned from auth creation');
          continue;
        }

        // Insert into public.users table
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            nim: nim,
            nama: result['Nama Mahasiswa'] || `Mahasiswa ${nim}`,
            email: email,
            role: 'mahasiswa',
            tingkat: result.TINGKAT,
            kelas: result.KELAS,
            level_user: 0
          });

        if (insertError) {
          console.error('Error inserting user data:', insertError);
          // If insert fails, clean up auth user
          await supabase.auth.admin.deleteUser(authData.user.id);
          continue;
        }

        registeredCount++;
        console.log(`Successfully registered student ${nim}`);
        
      } catch (error) {
        console.error('Error registering student:', error);
      }
    }
    
    console.log(`Registration summary: ${registeredCount} new students, ${existingCount} existing students`);
  };

  const saveResults = async () => {
    if (!selectedBatch) {
      setMessage({ type: 'error', text: 'Pilih batch terlebih dahulu' });
      return;
    }

    if (clusteringResults.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada hasil clustering untuk disimpan' });
      return;
    }

    try {
      setLoading(true);
      
      // Get user IDs for the results
      const resultsWithUserIds = await Promise.all(
        clusteringResults.map(async (result) => {
          const nim = result.NIM?.toString();
          if (!nim) return null;

          const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('nim', nim)
            .single();
          
          return {
            ...result,
            user_id: user?.id
          };
        })
      );

      // Filter out null results
      const validResults = resultsWithUserIds.filter(result => result && result.user_id);

      if (validResults.length === 0) {
        setMessage({ type: 'error', text: 'Tidak ada data mahasiswa yang valid untuk disimpan' });
        return;
      }

      await databaseAPI.saveClusteringResults(validResults, selectedBatch);
      setMessage({ type: 'success', text: `Berhasil menyimpan ${validResults.length} hasil clustering!` });
      setShowSaveModal(false);
      setClusteringResults([]);
    } catch (error) {
      console.error('Error saving results:', error);
      setMessage({ type: 'error', text: 'Gagal menyimpan hasil clustering' });
    } finally {
      setLoading(false);
    }
  };

  const apiConfigured = !!import.meta.env.VITE_CLUSTERING_API_URL;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Clustering DBSCAN</h1>
      </div>

      {/* API Configuration Warning */}
      {!apiConfigured && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <Settings className="w-5 h-5 text-yellow-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Konfigurasi API Diperlukan</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Layanan clustering belum dikonfigurasi. Tambahkan <code className="bg-yellow-100 px-1 rounded">VITE_CLUSTERING_API_URL</code> ke file environment Anda.
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Periode dan Batch Management */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Manajemen Periode & Batch</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setShowAddPeriodModal(true)}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Periode
          </button>

          <button
            onClick={() => setShowAddBatchModal(true)}
            disabled={!selectedPeriod}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Batch
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Periode *</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Pilih Periode</option>
              {periods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.nama_periode} {period.tahun_ajaran}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Batch *</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Pilih Batch</option>
              {batches
                .filter(batch => !selectedPeriod || batch.id_periode === selectedPeriod)
                .map(batch => (
                <option key={batch.id} value={batch.id}>
                  {batch.nama_batch}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Dataset Presensi</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File Dataset (.xlsx)
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tingkat Mahasiswa
            </label>
            <select
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sheetOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <button
            onClick={processClustering}
            disabled={!file || loading || !apiConfigured || !selectedPeriod || !selectedBatch}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Mulai Clustering
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {clusteringResults.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Hasil Clustering</h2>
            <button
              onClick={() => setShowSaveModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors duration-150 flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Simpan Hasil
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIM</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tingkat/Kelas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Alpa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kedisiplinan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clusteringResults.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.NIM}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result['Nama Mahasiswa']}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.TINGKAT} / {result.KELAS}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.TOTAL_A}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        result.KEDISIPLINAN === 'Disiplin' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {result.KEDISIPLINAN}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Cluster {result.Cluster}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Period Modal */}
      {showAddPeriodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tambah Periode</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Periode *</label>
                <input
                  type="text"
                  value={newPeriod.nama_periode}
                  onChange={(e) => setNewPeriod({...newPeriod, nama_periode: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Ganjil"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tahun Ajaran *</label>
                <input
                  type="text"
                  value={newPeriod.tahun_ajaran}
                  onChange={(e) => setNewPeriod({...newPeriod, tahun_ajaran: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: 2024/2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester (Opsional)</label>
                <input
                  type="text"
                  value={newPeriod.semester}
                  onChange={(e) => setNewPeriod({...newPeriod, semester: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Ganjil"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowAddPeriodModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
              >
                Batal
              </button>
              <button
                onClick={addPeriod}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-150"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tambah Batch</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Periode Terpilih</label>
                <input
                  type="text"
                  value={periods.find(p => p.id === selectedPeriod)?.nama_periode + ' ' + periods.find(p => p.id === selectedPeriod)?.tahun_ajaran || 'Belum dipilih'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Batch *</label>
                <input
                  type="text"
                  value={newBatch}
                  onChange={(e) => setNewBatch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Batch 1"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowAddBatchModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
              >
                Batal
              </button>
              <button
                onClick={addBatch}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-150"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Konfirmasi Simpan Hasil</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Periode:</p>
                <p className="font-medium">{periods.find(p => p.id === selectedPeriod)?.nama_periode} {periods.find(p => p.id === selectedPeriod)?.tahun_ajaran}</p>
                
                <p className="text-sm text-gray-600 mb-2 mt-3">Batch:</p>
                <p className="font-medium">{batches.find(b => b.id === selectedBatch)?.nama_batch}</p>
                
                <p className="text-sm text-gray-600 mb-2 mt-3">Jumlah Data:</p>
                <p className="font-medium">{clusteringResults.length} mahasiswa</p>
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
              >
                Batal
              </button>
              <button
                onClick={saveResults}
                disabled={loading}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}