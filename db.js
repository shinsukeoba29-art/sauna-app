// IndexedDB wrapper for サウナ管理アプリ
const DB_NAME = 'SaunaLogDB';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('saunas')) {
        const saunaStore = db.createObjectStore('saunas', { keyPath: 'id', autoIncrement: true });
        saunaStore.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('visits')) {
        const visitStore = db.createObjectStore('visits', { keyPath: 'id', autoIncrement: true });
        visitStore.createIndex('saunaId', 'saunaId', { unique: false });
        visitStore.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  // --- saunas ---
  async addSauna(sauna) {
    const store = await tx('saunas', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add({ ...sauna, createdAt: new Date().toISOString() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async updateSauna(sauna) {
    const store = await tx('saunas', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(sauna);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async deleteSauna(id) {
    const store = await tx('saunas', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async getAllSaunas() {
    const store = await tx('saunas', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async getSauna(id) {
    const store = await tx('saunas', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  // --- visits ---
  async addVisit(visit) {
    const store = await tx('visits', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add({ ...visit, createdAt: new Date().toISOString() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async updateVisit(visit) {
    const store = await tx('visits', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(visit);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async deleteVisit(id) {
    const store = await tx('visits', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async getAllVisits() {
    const store = await tx('visits', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async getVisitsBySauna(saunaId) {
    const store = await tx('visits', 'readonly');
    return new Promise((resolve, reject) => {
      const idx = store.index('saunaId');
      const req = idx.getAll(saunaId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async getVisit(id) {
    const store = await tx('visits', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  // --- bulk (for import/export) ---
  async clearAll() {
    const saunaStore = await tx('saunas', 'readwrite');
    await new Promise((resolve, reject) => {
      const req = saunaStore.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    const visitStore = await tx('visits', 'readwrite');
    await new Promise((resolve, reject) => {
      const req = visitStore.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  async bulkAddSaunas(saunas) {
    const store = await tx('saunas', 'readwrite');
    for (const s of saunas) {
      await new Promise((resolve, reject) => {
        const req = store.put(s);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  },
  async bulkAddVisits(visits) {
    const store = await tx('visits', 'readwrite');
    for (const v of visits) {
      await new Promise((resolve, reject) => {
        const req = store.put(v);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  },
};
