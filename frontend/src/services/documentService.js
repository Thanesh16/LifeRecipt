import api, { DOCUMENT_PROCESSING_TIMEOUT_MS } from './api';

export const documentService = {
  async uploadAndExtract(file, documentType = 'RECEIPT', productId = null, onUploadProgress = null) {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('documentType', documentType);
    if (productId) {
      formData.append('productId', productId);
    }

    const response = await api.post('/documents/upload-and-extract', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: DOCUMENT_PROCESSING_TIMEOUT_MS,
      onUploadProgress,
    });
    return response.data;
  },

  async confirmAndCreateProduct(documentId, productData) {
    const response = await api.post('/documents/confirm-product', {
      documentId,
      productData,
    });
    return response.data;
  },

  async getDocuments(params = {}) {
    const response = await api.get('/documents', { params });
    return response.data;
  },

  async getDocumentById(id) {
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },

  async deleteDocument(id) {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  },

  async downloadFile(id, fileName, isDownload = true) {
    const response = await api.get(`/documents/${id}/file`, {
      params: { download: isDownload ? 'true' : 'false' },
      responseType: 'blob',
    });

    // Create a client-side blob download link
    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/octet-stream',
    });
    const blobUrl = window.URL.createObjectURL(blob);

    if (isDownload) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName || 'document');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } else {
      // Open in a new tab for preview
      window.open(blobUrl, '_blank');
    }
  },

  async reprocessDocument(id, documentType) {
    const response = await api.post(`/documents/${id}/reprocess`, { documentType }, {
      timeout: DOCUMENT_PROCESSING_TIMEOUT_MS,
    });
    return response.data;
  },

  async linkProduct(id, productId) {
    const response = await api.post(`/documents/${id}/link-product`, { productId });
    return response.data;
  },

  async updateExtractedData(id, extractedData) {
    const response = await api.patch(`/documents/${id}/extracted-data`, { extractedData });
    return response.data;
  },
};

export default documentService;
