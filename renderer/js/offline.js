
// Offline queue using localStorage (fallback if idb-keyval not available)
const OFFLINE_KEY = 'gateQueue';

// Try to use idb-keyval if available, otherwise use localStorage
const useIDB = typeof window !== 'undefined' && window.idbKeyval;

async function queueScan(scan) {
  try {
    if (useIDB) {
      const arr = (await window.idbKeyval.get(OFFLINE_KEY)) || [];
      arr.push(scan);
      await window.idbKeyval.set(OFFLINE_KEY, arr);
    } else {
      // Fallback to localStorage
      const arr = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
      arr.push(scan);
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(arr));
    }
    console.log('Scan queued offline:', scan);
  } catch (e) {
    console.error('Error queueing scan:', e);
    throw e;
  }
}

async function flushQueue(sendFn) {
  try {
    let arr = [];
    if (useIDB) {
      arr = (await window.idbKeyval.get(OFFLINE_KEY)) || [];
    } else {
      arr = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
    }
    
    if (!arr.length) {
      console.log('Queue is empty');
      return { sent: 0 };
    }
    
    console.log('Flushing queue with', arr.length, 'items');
    const payload = { items: arr };
    await sendFn(payload);
    
    // Clear queue after successful flush
    if (useIDB) {
      await window.idbKeyval.set(OFFLINE_KEY, []);
    } else {
      localStorage.setItem(OFFLINE_KEY, '[]');
    }
    
    console.log('Queue flushed successfully');
    return { sent: arr.length };
  } catch (e) {
    console.error('Error flushing queue:', e);
    return { error: String(e) };
  }
}
