/**
 * Magic Points API module
 * Handles server-side interactions for Magic Points system
 */

// Backend base URL with the actual Render backend URL
const BACKEND_URL = 'https://be-web-6c4k.onrender.com'; 

// Flag to enable offline mode for development
const USE_OFFLINE_MODE = false;

// Helper for getting authentication token
const getAuthToken = () => {
  // Use the main auth token directly like the profile update does
  return localStorage.getItem('token') || '';
};

// Helper function to handle API errors
const handleApiError = (response, operation) => {
  if (!response.ok) {
    const errorMsg = `Failed to ${operation} (Status: ${response.status})`;
    console.error(`[API] ${errorMsg}`);
    
    // Handle authentication errors specifically
    if (response.status === 401 || response.status === 403) {
      console.error('[API] Authentication error - verify you are logged in');
      console.log('[API] Auth token:', localStorage.getItem('token') ? 'Present' : 'Missing');
    }
    
    throw new Error(errorMsg);
  }
  return response;
};

// Simulate API response for offline mode
const simulateOfflineResponse = (data, delay = 500) => {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log('[API] Simulated offline response:', data);
      resolve(data);
    }, delay);
  });
};

// Fetch user's magic points from the server
export const fetchMagicPoints = async () => {
  try {
    // If offline mode is enabled, return simulated response
    if (USE_OFFLINE_MODE) {
      console.log('[API] Using offline mode for fetchMagicPoints');
      const localPoints = localStorage.getItem('magicPoints') || '100';
      return simulateOfflineResponse({ magicPoints: parseInt(localPoints, 10) });
    }
    
    console.log('[API] Fetching magic points from server');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${BACKEND_URL}/api/user/magic-points`, {
      credentials: 'include', // Send cookies for cross-site requests
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    handleApiError(response, 'fetch magic points');
    
    const data = await response.json();
    console.log('[API] Fetched magic points:', data);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[API] Fetch magic points request timed out');
      throw new Error('Request timed out');
    }
    console.error('[API] Error fetching magic points:', error);
    throw error;
  }
};

// Update magic points on the server
export const updateMagicPoints = async (points) => {
  try {
    // If offline mode is enabled, return simulated response
    if (USE_OFFLINE_MODE) {
      console.log('[API] Using offline mode for updateMagicPoints:', points);
      localStorage.setItem('magicPoints', points.toString());
      return simulateOfflineResponse({
        magicPoints: points,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('[API] Updating magic points on server to:', points);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${BACKEND_URL}/api/user/magic-points`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        magicPoints: points,
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    handleApiError(response, 'update magic points');
    
    const data = await response.json();
    console.log('[API] Successfully updated magic points:', data);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[API] Update magic points request timed out');
      throw new Error('Request timed out');
    }
    console.error('[API] Error updating magic points:', error);
    throw error;
  }
};

// Sync multiple operations to the server
export const syncMagicPointsOperations = async (operations) => {
  try {
    // Validate operations before sending
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      console.error('[API] Invalid operations for sync:', operations);
      throw new Error('Invalid or empty operations array');
    }
    
    // If offline mode is enabled, process operations locally
    if (USE_OFFLINE_MODE) {
      console.log('[API] Using offline mode for syncMagicPointsOperations:', operations.length);
      
      // Process operations locally
      let currentPoints = parseInt(localStorage.getItem('magicPoints') || '100', 10);
      console.log(`[API] Starting with ${currentPoints} points`);
      
      operations.forEach(op => {
        if (op.type === 'add') {
          currentPoints += op.amount;
        } else if (op.type === 'remove') {
          currentPoints = Math.max(0, currentPoints - op.amount);
        } else if (op.type === 'set') {
          currentPoints = Math.max(0, op.amount);
        }
      });
      
      console.log(`[API] After processing operations, new point value: ${currentPoints}`);
      localStorage.setItem('magicPoints', currentPoints.toString());
      
      return simulateOfflineResponse({
        magicPoints: currentPoints,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('[API] Syncing magic points operations to server:', operations.length);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for potentially larger operation
    
    // Log the request data for debugging
    console.log('[API] Request payload:', JSON.stringify({ operations }).slice(0, 200) + '...');
    console.log('[API] Using auth token:', getAuthToken() ? 'Present' : 'Missing');
    
    const response = await fetch(`${BACKEND_URL}/api/user/magic-points/sync`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        operations
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Log response status and headers for debugging
    console.log(`[API] Sync response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      // Try to get the error message from response if possible
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || `HTTP error ${response.status}`;
      } catch (e) {
        errorMessage = `HTTP error ${response.status}`;
      }
      
      // Log detailed error for auth issues
      if (response.status === 401) {
        console.error('[API] Authentication failed. Not logged in or session expired.');
        const token = getAuthToken();
        console.log('[API] Auth token available:', !!token);
      }
      
      console.error(`[API] Failed to sync magic points operations: ${errorMessage}`);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('[API] Successfully synced magic points operations:', data);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[API] Sync magic points operations request timed out');
      throw new Error('Request timed out');
    }
    console.error('[API] Error syncing magic points operations:', error);
    throw error;
  }
};

// Check if we're online
export const isOnline = () => {
  return navigator.onLine;
};

// Store points locally for offline use
export const storePointsLocally = (points) => {
  try {
    localStorage.setItem('magicPoints', points);
    localStorage.setItem('magicPointsTimestamp', new Date().toISOString());
    return true;
  } catch (error) {
    console.error('[API] Error storing points locally:', error);
    return false;
  }
};

// Get locally stored points
export const getLocalPoints = () => {
  try {
    const points = localStorage.getItem('magicPoints');
    return points ? parseInt(points, 10) : 100;
  } catch (error) {
    console.error('[API] Error getting local points:', error);
    return 100;
  }
};
