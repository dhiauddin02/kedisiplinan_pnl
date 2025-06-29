import React, { useState } from 'react';
import { Upload, UserPlus, Users, AlertCircle, CheckCircle, FileSpreadsheet, Settings } from 'lucide-react';
import { clusteringAPI } from '../lib/api';
import { registerUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { processBatch, generateEmail } from '../lib/utils';

export default function TambahMahasiswa() {
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState('REKAP-TK1');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const sheetOptions = [
    'REKAP-TK1', 'REKAP-TK2', 'REKAP-TK3', 'REKAP-TK4'
  ];

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

  const validateDataset = () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Pilih file terlebih dahulu' });
      return false;
    }
    return true;
  };

  const processDataset = async () => {
    if (!validateDataset()) return;

    setLoading(true);
    setMessage({ type: 'info', text: 'Memproses dataset...' });

    try {
      // Send to clustering API to read the Excel file
      const results = await clusteringAPI.processFile(file!, sheetName);
      
      // Extract only NIM and Nama Mahasiswa
      const studentData = results.map((result: any) => ({
        nim: result.NIM?.toString() || '',
        nama: result['Nama Mahasiswa'] || '',
        tingkat: result.TINGKAT || '',
        kelas: result.KELAS || ''
      })).filter((student: any) => student.nim && student.nama);

      setProcessedData(studentData);
      setMessage({ type: 'success', text: `Berhasil memproses ${studentData.length} data mahasiswa dari file!` });
    } catch (error) {
      console.error('Processing error:', error);
      
      let errorMessage = 'Gagal memproses dataset';
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

  const checkExistingUser = async (nim: string): Promise<boolean> => {
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('nim', nim)
        .maybeSingle();
      
      return !!existingUser;
    } catch (error) {
      console.error('Error checking existing user:', error);
      return false;
    }
  };

  const registerSingleStudent = async (student: any): Promise<{ success: boolean; reason?: string }> => {
    try {
      // Check if user already exists first
      const userExists = await checkExistingUser(student.nim);
      
      if (userExists) {
        return { success: false, reason: 'already_exists' };
      }

      // Generate email
      const email = generateEmail(student.nama, student.nim);

      // Register the student
      const newUser = await registerUser({
        email: email,
        password: student.nim, // Use NIM as default password
        nama: student.nama,
        nim: student.nim,
        role: 'mahasiswa',
        level_user: 0,
        tingkat: student.tingkat,
        kelas: student.kelas
      });

      if (newUser) {
        return { success: true };
      } else {
        return { success: false, reason: 'registration_failed' };
      }

    } catch (error) {
      console.error('Error registering student:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('already registered') || 
            error.message.includes('User already registered') ||
            error.message.includes('duplicate')) {
          return { success: false, reason: 'already_exists' };
        } else if (error.message.includes('rate') || 
                  error.message.includes('too many') ||
                  error.message.includes('429')) {
          return { success: false, reason: 'rate_limit' };
        }
      }
      
      return { success: false, reason: 'error' };
    }
  };

  const addStudents = async () => {
    if (processedData.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data mahasiswa untuk ditambahkan' });
      return;
    }

    setLoading(true);
    setProgress({ current: 0, total: processedData.length });
    setMessage({ type: 'info', text: 'Menambahkan data mahasiswa secara berurutan...' });

    let addedCount = 0;
    let existingCount = 0;
    let errorCount = 0;
    const addedStudents: string[] = [];
    const existingStudents: string[] = [];
    const errorStudents: string[] = [];

    try {
      // Use processBatch with batchSize = 1 to process students one by one
      await processBatch(
        processedData,
        async (student: any, index: number) => {
          // Update progress
          setProgress({ current: index + 1, total: processedData.length });
          
          const result = await registerSingleStudent(student);
          
          if (result.success) {
            addedCount++;
            addedStudents.push(`${student.nim} - ${student.nama}`);
            console.log(`Successfully added student ${student.nim}`);
          } else {
            switch (result.reason) {
              case 'already_exists':
                existingCount++;
                existingStudents.push(`${student.nim} - ${student.nama}`);
                console.log(`Student ${student.nim} already exists`);
                break;
              case 'rate_limit':
                errorCount++;
                errorStudents.push(`${student.nim} - ${student.nama} (Rate limit)`);
                console.log(`Rate limit hit for student ${student.nim}`);
                break;
              default:
                errorCount++;
                errorStudents.push(`${student.nim} - ${student.nama}`);
                console.log(`Failed to add student ${student.nim}`);
            }
          }

          return result;
        },
        1, // Process one student at a time
        500 // 500ms delay between each student
      );

      // Show detailed results
      let resultMessage = '';
      if (addedCount > 0) {
        resultMessage += `✅ ${addedCount} mahasiswa berhasil ditambahkan. `;
      }
      if (existingCount > 0) {
        resultMessage += `ℹ️ ${existingCount} mahasiswa sudah terdaftar sebelumnya. `;
      }
      if (errorCount > 0) {
        resultMessage += `❌ ${errorCount} mahasiswa gagal ditambahkan.`;
      }

      setMessage({ 
        type: addedCount > 0 ? 'success' : existingCount > 0 ? 'info' : 'error', 
        text: resultMessage || 'Tidak ada mahasiswa yang ditambahkan'
      });

      // Clear processed data after processing
      if (addedCount > 0 || existingCount > 0) {
        setProcessedData([]);
        setFile(null);
      }

    } catch (error) {
      console.error('Error adding students:', error);
      setMessage({ type: 'error', text: 'Gagal menambahkan data mahasiswa' });
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const apiConfigured = !!import.meta.env.VITE_CLUSTERING_API_URL;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Tambah Mahasiswa</h1>
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

      {/* Progress Bar */}
      {loading && progress.total > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Memproses mahasiswa secara berurutan dengan jeda 500ms antar mahasiswa...
          </p>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Dataset Mahasiswa</h2>
        
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
            onClick={processDataset}
            disabled={!file || loading || !apiConfigured}
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

      {/* Processed Data Section */}
      {processedData.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Data Mahasiswa yang Akan Ditambahkan</h2>
            <button
              onClick={addStudents}
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors duration-150 disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Tambah Semua ({processedData.length})
            </button>
          </div>

          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Total:</strong> {processedData.length} mahasiswa siap ditambahkan. 
              Sistem akan memproses setiap mahasiswa secara berurutan dengan jeda 500ms untuk menghindari rate limiting.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIM</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Mahasiswa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tingkat/Kelas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email yang Akan Dibuat</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedData.map((student, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nim}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.tingkat} / {student.kelas}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {generateEmail(student.nama, student.nim)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Informasi Penting</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Sistem akan mengambil data NIM dan Nama Mahasiswa dari file Excel</li>
                <li>Email akan dibuat otomatis dengan format: nama_mahasiswa + 3 digit terakhir NIM + @student.pnl.ac.id</li>
                <li>Sistem akan memeriksa mahasiswa yang sudah terdaftar sebelum menambahkan</li>
                <li>Password default untuk mahasiswa baru adalah NIM mereka</li>
                <li>Data tingkat dan kelas juga akan disimpan jika tersedia di file</li>
                <li><strong>Proses berurutan:</strong> Setiap mahasiswa akan diproses satu per satu dengan jeda 500ms</li>
                <li>Progress akan ditampilkan selama proses penambahan data</li>
                <li>Semua data mahasiswa akan ditampilkan dalam tabel untuk review sebelum ditambahkan</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}