import React, { useState } from 'react';
import { Upload, UserPlus, Users, AlertCircle, CheckCircle, FileSpreadsheet, Settings, Bug } from 'lucide-react';
import { clusteringAPI } from '../lib/api';
import { registerUserAuthOnly, debugAdminStatus, getCurrentUser } from '../lib/auth';
import { generateEmail } from '../lib/utils';

export default function TambahMahasiswa() {
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState('REKAP-TK1');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [debugInfo, setDebugInfo] = useState<string>('');

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

  const registerSingleStudent = async (student: any): Promise<{ success: boolean; reason?: string }> => {
    try {
      // Generate email
      const email = generateEmail(student.nama, student.nim);

      // Register the student using auth-only registration
      const newUser = await registerUserAuthOnly({
        email: email,
        password: student.nim, // Use NIM as default password
        nama: student.nama,
        nim: student.nim,
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

    // Verify admin status before starting
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      setMessage({ type: 'error', text: 'Anda harus login sebagai admin untuk menambah mahasiswa' });
      return;
    }

    setLoading(true);
    setProgress({ current: 0, total: processedData.length });
    setMessage({ type: 'info', text: 'Memulai pembuatan akun autentikasi untuk mahasiswa...' });

    let addedCount = 0;
    let existingCount = 0;
    let errorCount = 0;
    const addedStudents: string[] = [];
    const existingStudents: string[] = [];
    const errorStudents: string[] = [];

    try {
      // Process students one by one
      for (let i = 0; i < processedData.length; i++) {
        const student = processedData[i];
        
        // Update progress
        setProgress({ current: i + 1, total: processedData.length });
        setMessage({ type: 'info', text: `Memproses mahasiswa ${i + 1}/${processedData.length}: ${student.nama}` });
        
        const result = await registerSingleStudent(student);
        
        if (result.success) {
          addedCount++;
          addedStudents.push(`${student.nim} - ${student.nama}`);
          console.log(`Successfully created auth for student ${student.nim}`);
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
              console.log(`Failed to create auth for student ${student.nim}`);
          }
        }

        // Add delay between students to avoid rate limiting
        if (i < processedData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Show detailed results
      let resultMessage = '';
      if (addedCount > 0) {
        resultMessage += `✅ ${addedCount} akun autentikasi mahasiswa berhasil dibuat. `;
      }
      if (existingCount > 0) {
        resultMessage += `ℹ️ ${existingCount} mahasiswa sudah memiliki akun sebelumnya. `;
      }
      if (errorCount > 0) {
        resultMessage += `❌ ${errorCount} mahasiswa gagal diproses.`;
      }

      setMessage({ 
        type: addedCount > 0 ? 'success' : existingCount > 0 ? 'info' : 'error', 
        text: resultMessage || 'Tidak ada mahasiswa yang diproses'
      });

      // Clear processed data after processing
      if (addedCount > 0 || existingCount > 0) {
        setProcessedData([]);
        setFile(null);
      }

    } catch (error) {
      console.error('Error adding students:', error);
      setMessage({ type: 'error', text: 'Gagal memproses data mahasiswa' });
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0 });
      
      // Verify admin session is still active
      const finalUser = getCurrentUser();
      if (finalUser?.role === 'admin') {
        console.log('Admin session maintained successfully');
      } else {
        console.warn('Admin session may have been lost');
        setMessage({ type: 'error', text: 'Sesi admin mungkin telah berubah. Silakan refresh halaman dan login kembali.' });
      }
    }
  };

  const runDebugCheck = async () => {
    setLoading(true);
    setMessage({ type: 'info', text: 'Menjalankan debug check...' });
    
    try {
      await debugAdminStatus();
      setMessage({ type: 'success', text: 'Debug check completed. Lihat console untuk detail.' });
    } catch (error) {
      console.error('Debug error:', error);
      setMessage({ type: 'error', text: 'Error saat menjalankan debug check' });
    } finally {
      setLoading(false);
    }
  };

  const apiConfigured = !!import.meta.env.VITE_CLUSTERING_API_URL;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Tambah Mahasiswa</h1>
        <button
          onClick={runDebugCheck}
          disabled={loading}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors duration-150 disabled:opacity-50 flex items-center"
        >
          <Bug className="w-4 h-4 mr-2" />
          Debug Check
        </button>
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
            Membuat akun autentikasi untuk mahasiswa...
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
            <h2 className="text-xl font-semibold text-gray-900">Data Mahasiswa yang Akan Diproses</h2>
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
              Buat Akun Autentikasi ({processedData.length})
            </button>
          </div>

          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Total:</strong> {processedData.length} mahasiswa akan dibuatkan akun autentikasi. 
              Mahasiswa akan melengkapi profil mereka sendiri setelah login pertama.
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Password Default</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {student.nim}
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
            <h3 className="text-sm font-medium text-blue-800">Alur Baru - Self Registration</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Admin:</strong> Hanya membuat akun autentikasi dasar untuk mahasiswa</li>
                <li><strong>Email:</strong> Dibuat otomatis dengan format nama_mahasiswa + 3 digit NIM terakhir + @student.pnl.ac.id</li>
                <li><strong>Password Default:</strong> NIM mahasiswa</li>
                <li><strong>Mahasiswa:</strong> Login dengan email dan NIM, kemudian melengkapi profil sendiri</li>
                <li><strong>Data Profil:</strong> Nama, NIM, tingkat, kelas, data wali, data dosen pembimbing diisi oleh mahasiswa</li>
                <li><strong>Keamanan:</strong> Sistem menggunakan Supabase Auth untuk autentikasi yang aman</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}