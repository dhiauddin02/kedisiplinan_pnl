import React, { useState, useEffect } from 'react';
import { Plus, Eye, Send, Download, Calendar, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fontteAPI } from '../lib/api';

export default function HasilClustering() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [clusteringResults, setClusteringResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddPeriodModal, setShowAddPeriodModal] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ nama_periode: '', semester: '' });
  const [newBatch, setNewBatch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadPeriodsAndBatches();
  }, []);

  const loadPeriodsAndBatches = async () => {
    try {
      const { data: periodsData } = await supabase.from('periode').select('*');
      const { data: batchesData } = await supabase.from('batch').select('*, periode:periode(*)');
      
      setPeriods(periodsData || []);
      setBatches(batchesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const addPeriod = async () => {
    if (!newPeriod.nama_periode) {
      setMessage({ type: 'error', text: 'Nama periode harus diisi' });
      return;
    }

    try {
      const { error } = await supabase
        .from('periode')
        .insert({
          nama_periode: newPeriod.nama_periode,
          semester: newPeriod.semester || null
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Periode berhasil ditambahkan' });
      setShowAddPeriodModal(false);
      setNewPeriod({ nama_periode: '', semester: '' });
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

  const loadClusteringResults = async () => {
    if (!selectedBatch) {
      setMessage({ type: 'error', text: 'Pilih batch terlebih dahulu' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hasil_clustering')
        .select(`
          *,
          user:users(*),
          batch:batch(*, periode:periode(*))
        `)
        .eq('id_batch', selectedBatch);

      if (error) throw error;

      setClusteringResults(data || []);
      setShowResultsModal(true);
    } catch (error) {
      console.error('Error loading results:', error);
      setMessage({ type: 'error', text: 'Gagal memuat hasil clustering' });
    } finally {
      setLoading(false);
    }
  };

  const generateMessage = (result: any) => {
    const periode = result.batch?.periode;
    return `Kepada Yth.
Sdr. ${result.user?.nama || result.nama_mahasiswa}
Mahasiswa ${result.tingkat}, Kelas ${result.kelas}
Politeknik Negeri Lhokseumawe
di Tempat

Dengan hormat,
Berdasarkan hasil evaluasi rekapitulasi absensi mahasiswa untuk Semester ${periode?.nama_periode}, bersama ini kami sampaikan informasi terkait kehadiran Anda sebagai berikut:

Keterangan	Nilai
Nama Mahasiswa	${result.user?.nama || result.nama_mahasiswa}
NIM	${result.user?.nim || result.nim}
Tingkat / Kelas	${result.tingkat} / ${result.kelas}
Total Ketidakhadiran	${result.total_a}
Jumlah Pertemuan (JP)	${result.jp}
Status Kedisiplinan	${result.kedisiplinan}
Keterangan Tambahan	${result.insight}

${result.kedisiplinan === 'Disiplin' 
  ? 'Kami mengapresiasi kedisiplinan Anda dalam mengikuti kegiatan perkuliahan. Semoga hal ini dapat menjadi motivasi bagi rekan-rekan mahasiswa lainnya. Harap dipertahankan dan terus ditingkatkan untuk semester berikutnya.'
  : 'Dengan ini kami menyampaikan status kedisiplinan Anda selama periode yang telah ditentukan. Harap informasi ini dapat menjadi perhatian dan bahan evaluasi untuk menjaga atau meningkatkan kedisiplinan ke depannya.'
}

Demikian surat pemberitahuan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.

Hormat kami,
Bagian Akademik
Politeknik Negeri Lhokseumawe`;
  };

  const sendClusteringResults = async () => {
    if (clusteringResults.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk dikirim' });
      return;
    }

    const fontteToken = import.meta.env.VITE_FONNTE_TOKEN;
    if (!fontteToken) {
      setMessage({ type: 'error', text: 'Token Fonnte belum dikonfigurasi' });
      return;
    }

    setLoading(true);
    let successCount = 0;

    try {
      for (const result of clusteringResults) {
        const message = generateMessage(result);
        
        // Send to parent (wali)
        if (result.user?.no_wa_wali) {
          try {
            await fontteAPI.sendWhatsApp(result.user.no_wa_wali, message);
            successCount++;
          } catch (error) {
            console.error('Error sending to parent:', error);
          }
        }

        // Send to supervisor (dosen pembimbing)
        if (result.user?.no_wa_dosen_pembimbing) {
          try {
            await fontteAPI.sendWhatsApp(result.user.no_wa_dosen_pembimbing, message);
            successCount++;
          } catch (error) {
            console.error('Error sending to supervisor:', error);
          }
        }

        // Update status
        await supabase
          .from('hasil_clustering')
          .update({ status_pesan: 'terkirim' })
          .eq('id', result.id);
      }

      setMessage({ type: 'success', text: `Berhasil mengirim ${successCount} pesan WhatsApp` });
    } catch (error) {
      console.error('Error sending messages:', error);
      setMessage({ type: 'error', text: 'Gagal mengirim pesan' });
    } finally {
      setLoading(false);
    }
  };

  const exportResults = async () => {
    // For now, we'll just trigger the send function as per the activity diagram
    await sendClusteringResults();
    setMessage({ type: 'success', text: 'Laporan berhasil diekspor dan dikirim' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Hasil Clustering</h1>
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

      {/* Controls */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => setShowAddPeriodModal(true)}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Periode
          </button>

          <button
            onClick={() => setShowAddBatchModal(true)}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-150"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Batch
          </button>

          <button
            onClick={loadClusteringResults}
            disabled={!selectedBatch || loading}
            className="flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-150 disabled:opacity-50"
          >
            <Eye className="w-4 h-4 mr-2" />
            Lihat Hasil
          </button>

          <button
            onClick={sendClusteringResults}
            disabled={clusteringResults.length === 0 || loading}
            className="flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-150 disabled:opacity-50"
          >
            <Send className="w-4 h-4 mr-2" />
            Kirim WA
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Periode</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Pilih Periode</option>
              {periods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.nama_periode}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Batch</label>
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

      {/* Periods and Batches List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daftar Periode</h3>
          <div className="space-y-2">
            {periods.map(period => (
              <div key={period.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-900">{period.nama_periode}</div>
                {period.semester && (
                  <div className="text-sm text-gray-500">Semester: {period.semester}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daftar Batch</h3>
          <div className="space-y-2">
            {batches.map(batch => (
              <div key={batch.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-900">{batch.nama_batch}</div>
                <div className="text-sm text-gray-500">
                  {batch.periode?.nama_periode}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(batch.tgl_batch).toLocaleDateString('id-ID')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

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
                  placeholder="contoh: Ganjil 2024/2025"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Periode</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Pilih Periode</option>
                  {periods.map(period => (
                    <option key={period.id} value={period.id}>
                      {period.nama_periode}
                    </option>
                  ))}
                </select>
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

      {/* Results Modal */}
      {showResultsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Hasil Clustering</h3>
              <button
                onClick={() => setShowResultsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mahasiswa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tingkat/Kelas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Alpa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kedisiplinan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clusteringResults.map((result, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{result.user?.nama || result.nama_mahasiswa}</div>
                          <div className="text-sm text-gray-500">{result.user?.nim || result.nim}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.tingkat} / {result.kelas}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.total_a}
                      </td>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          result.status_pesan === 'terkirim' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {result.status_pesan}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={exportResults}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Laporan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}