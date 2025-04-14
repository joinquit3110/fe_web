/**
 * Scores API module
 * Handles server-side interactions for the scores system
 */

import { getAuthToken } from './authApi';

// Backend base URL
const BACKEND_URL = 'https://be-web-6c4k.onrender.com'; 

/**
 * Get user's score history
 * 
 * This fetches the complete score history showing all point changes over time
 */
const retryWithBackoff = async (fn, retries = 3, backoff = 300) => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, backoff));
    return retryWithBackoff(fn, retries - 1, backoff * 2);
  }
};

export const getScoreHistory = async () => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    
    // Add caching
    const cacheKey = `score_history_${token}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const {timestamp, data} = JSON.parse(cached);
      if (Date.now() - timestamp < 60000) return data;
    }
    
    const response = await fetch(`${BACKEND_URL}/api/user/scores/history`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch scores (Status: ${response.status})`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[API] Error fetching score history:', error);
    throw error;
  }
};

/**
 * Get user's score statistics
 * 
 * This provides aggregated stats about score changes by category and time periods
 */
export const getScoreStats = async () => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${BACKEND_URL}/api/user/scores/stats`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch score stats (Status: ${response.status})`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[API] Error fetching score stats:', error);
    throw error;
  }
};
