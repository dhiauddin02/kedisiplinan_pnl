import { supabase } from './supabase';

export const clusteringAPI = {
  async processFile(file: File, sheetName: string) {
    const apiUrl = import.meta.env.VITE_CLUSTERING_API_URL;
    
    if (!apiUrl) {
      throw new Error('Clustering API URL not configured. Please set VITE_CLUSTERING_API_URL in your environment variables.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sheet_name', sheetName);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Clustering API error (${response.status}): ${errorText || 'Unknown error'}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Cannot connect to clustering service. Please ensure the clustering API server is running.');
      }
      throw error;
    }
  }
};

export const fontteAPI = {
  async sendWhatsApp(target: string, message: string) {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': import.meta.env.VITE_FONNTE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target,
        message,
        countryCode: '62'
      })
    });

    return response.json();
  }
};

export const databaseAPI = {
  async getAllClusteringResults() {
    const { data, error } = await supabase
      .from('hasil_clustering')
      .select(`
        *,
        user:users(*),
        batch:batch(
          *,
          periode:periode(*)
        )
      `);

    if (error) throw error;
    return data;
  },

  async saveClusteringResults(results: any[], batchId: string) {
    const clusteringData = results.map(result => ({
      id_user: result.user_id,
      id_batch: batchId,
      nim: result.NIM?.toString(),
      nama_mahasiswa: result['Nama Mahasiswa'],
      tingkat: result.TINGKAT,
      kelas: result.KELAS,
      total_a: result.TOTAL_A,
      jp: result.JP,
      kedisiplinan: result.KEDISIPLINAN,
      cluster: result.Cluster?.toString(),
      insight: result.Insight,
      nilai_matkul: result,
      status_pesan: 'belum terkirim'
    }));

    const { data, error } = await supabase
      .from('hasil_clustering')
      .insert(clusteringData);

    if (error) throw error;
    return data;
  },

  async createPeriode(namaPeriode: string, tahunAjaran: string) {
    const { data, error } = await supabase
      .from('periode')
      .insert({ nama_periode: namaPeriode, tahun_ajaran: tahunAjaran });

    if (error) throw error;
    return data;
  },

  async createBatch(namaBatch: string, idPeriode: string) {
    const { data, error } = await supabase
      .from('batch')
      .insert({ 
        nama_batch: namaBatch, 
        id_periode: idPeriode,
        tgl_batch: new Date().toISOString().split('T')[0]
      });

    if (error) throw error;
    return data;
  }
};