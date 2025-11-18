
import { useEffect, useState, useCallback } from 'react';
import { User } from '@/entities/User';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function useInactivityLogout() {
  const [lastActivity, setLastActivity] = useState(Date.now());

  const handleLogout = useCallback(async () => {
    try {
      console.log("Session expired due to inactivity. Logging out...");
      await User.logout();
    } catch (error) {
      console.error("Error during automatic logout:", error);
    } finally {
      // Clear all session-related data regardless of API call success
      window.localStorage.clear();
      window.location.href = '/'; // Redirect to home/login page
    }
  }, []);

  const resetTimer = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    // Add event listeners to reset the inactivity timer
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Set up the interval to check for inactivity
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        handleLogout();
      }
    }, 10000); // Check every 10 seconds

    // Cleanup function to remove listeners and interval
    return () => {
      clearInterval(interval);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [lastActivity, handleLogout, resetTimer]);

  return null; // This hook doesn't render anything
}
