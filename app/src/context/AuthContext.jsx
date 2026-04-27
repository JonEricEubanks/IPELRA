/**
 * AuthContext.jsx — Attendee session state (JWT + profile)
 */

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [attendee, setAttendee] = useState(null);
  const [token, setToken]       = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    // Restore session from storage on mount
    const storedToken = localStorage.getItem('passport_token')
      ?? sessionStorage.getItem('passport_token');
    const storedAttendee = localStorage.getItem('passport_attendee')
      ?? sessionStorage.getItem('passport_attendee');

    if (storedToken && storedAttendee) {
      try {
        const parsed = JSON.parse(storedAttendee);
        setToken(storedToken);
        setAttendee(parsed);
      } catch {
        localStorage.removeItem('passport_token');
        localStorage.removeItem('passport_attendee');
      }
    }
    setLoading(false);
  }, []);

  function login(sessionToken, attendeeData) {
    setToken(sessionToken);
    setAttendee(attendeeData);
    // Try localStorage first; fall back to sessionStorage (iOS Safari private mode)
    try {
      localStorage.setItem('passport_token', sessionToken);
      localStorage.setItem('passport_attendee', JSON.stringify(attendeeData));
    } catch {
      sessionStorage.setItem('passport_token', sessionToken);
      sessionStorage.setItem('passport_attendee', JSON.stringify(attendeeData));
    }
  }

  function updateAttendee(updates) {
    setAttendee(prev => {
      const updated = { ...prev, ...updates };
      try {
        localStorage.setItem('passport_attendee', JSON.stringify(updated));
      } catch {
        sessionStorage.setItem('passport_attendee', JSON.stringify(updated));
      }
      return updated;
    });
  }

  function logout() {
    setToken(null);
    setAttendee(null);
    localStorage.removeItem('passport_token');
    localStorage.removeItem('passport_attendee');
    sessionStorage.removeItem('passport_token');
    sessionStorage.removeItem('passport_attendee');
  }

  return (
    <AuthContext.Provider value={{ attendee, token, loading, login, logout, updateAttendee }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
